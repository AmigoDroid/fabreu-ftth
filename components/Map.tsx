"use client"

import {
  GoogleMap,
  Marker,
  Polyline,
  DrawingManager,
  useLoadScript,
  InfoWindow
} from "@react-google-maps/api"

import { Client, FiberSegment } from "@/types/ftth"
import { useEffect, useState } from "react"
import { PopupSalvar } from "./formInput"
import { getCurrentCoordinates } from "@/util/geolocaton"

const containerStyle = {
  width: "100%",
  height: "100vh"
}

type Props = {
  clients: Client[]
  fibers: FiberSegment[]
  drawMode?: boolean
}

export default function Map({ clients, fibers, drawMode = false }: Props) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries: drawMode
      ? ["drawing", "geometry"]
      : ["geometry"]
  })

  const [mapCenter, setMapCenter] =
    useState<google.maps.LatLngLiteral | null>(null)

  const [fiberList, setFiberList] = useState<FiberSegment[]>(fibers)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedFiber, setSelectedFiber] = useState<FiberSegment | null>(null)

  const [fibraPathTemp, setFibraPathTemp] =
    useState<{ lat: number; lng: number }[]>([])

  const [salve, setSalve] = useState(false)

  /* ================= LOCALIZAÇÃO INICIAL ================= */
  useEffect(() => {
    getCurrentCoordinates()
      .then((pos) => {
        setMapCenter({
          lat: pos.latitude,
          lng: pos.longitude
        })
      })
      .catch(() => {
        setMapCenter({ lat: -23.55052, lng: -46.633308 })
      })
  }, [])

  if (!isLoaded || !mapCenter) {
    return <p>Carregando mapa...</p>
  }

  /* ================= FUNÇÕES ================= */

  function getFiberCenter(path: { lat: number; lng: number }[]) {
    return path[Math.floor(path.length / 2)]
  }

  function calcularComprimento(
    path: { lat: number; lng: number }[]
  ) {
    let total = 0

    for (let i = 1; i < path.length; i++) {
      const p1 = new google.maps.LatLng(path[i - 1])
      const p2 = new google.maps.LatLng(path[i])
      total +=
        google.maps.geometry.spherical.computeDistanceBetween(
          p1,
          p2
        )
    }

    return total // metros
  }

  function calcularPerdaGPON(
    comprimentoMetros: number,
    {
      emendas = 2,
      conectores = 2,
      splitterDb = 17 // splitter 1:32
    } = {}
  ) {
    const km = comprimentoMetros / 1000

    const perdaFibra = km * 0.25 // dB/km @1490nm
    const perdaEmendas = emendas * 0.1
    const perdaConectores = conectores * 0.2

    const perdaTotal =
      perdaFibra +
      perdaEmendas +
      perdaConectores +
      splitterDb

    return {
      perdaFibra,
      perdaEmendas,
      perdaConectores,
      splitterDb,
      perdaTotal
    }
  }

  return (
    <>
      {/* ================= POPUP SALVAR ================= */}
      <PopupSalvar
        open={salve}
        onSalvar={(form) => {
          setFiberList((prev) => [
            ...prev,
            {
              id: Date.now(),
              nome: form.campo1,
              descricao: form.campo2,
              color: "#000000",
              path: [...fibraPathTemp]
            }
          ])
          setSalve(false)
        }}
        onContinuar={() => setSalve(false)}
        onCancelar={() => setSalve(false)}
      />

      {/* ================= MAPA ================= */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={16}
      >
        {/* ================= CLIENTES ================= */}
        {clients.map((c) => (
          <Marker
            key={c.id}
            position={c.position}
            onClick={() => {
              setSelectedClient(c)
              setSelectedFiber(null)
            }}
          />
        ))}

        {selectedClient && (
          <InfoWindow
            position={selectedClient.position}
            onCloseClick={() => setSelectedClient(null)}
          >
            <div>
              <strong>{selectedClient.nome}</strong>
              <br />
              RX: {selectedClient.rx} dBm
            </div>
          </InfoWindow>
        )}

        {/* ================= FIBRAS ================= */}
        {fiberList.map((f) => {
          const isSelected = selectedFiber?.id === f.id

          return (
            <Polyline
              key={f.id}
              path={f.path}
              options={{
                strokeColor: isSelected ? "#00ffff" : f.color,
                strokeWeight: isSelected ? 8 : 5,
                strokeOpacity: isSelected ? 1 : 0.8,
                clickable: true,
                zIndex: isSelected ? 99 : 10
              }}
              onClick={() => {
                setSelectedFiber(f)
                setSelectedClient(null)
              }}
            />
          )
        })}

        {/* INFO FIBRA */}
        {selectedFiber && (() => {
          const comprimento = calcularComprimento(
            selectedFiber.path
          )
          const perda = calcularPerdaGPON(comprimento,{ emendas:0, conectores:0, splitterDb:0 })

          return (
            <InfoWindow
              position={getFiberCenter(selectedFiber.path)}
              onCloseClick={() => setSelectedFiber(null)}
            >
              <div style={{ minWidth: 220 }}>
                <strong>
                  Fibra: {selectedFiber.nome}
                </strong>
                <br />
                📏 {comprimento <= 1000? comprimento.toFixed(1) : (comprimento/1000).toFixed(2)} km
                <br />
                📉 Perda estimada:{" "}
                {perda.perdaTotal.toFixed(2)} dB
                <hr />
                <small>
                  Fibra:{" "}
                  {perda.perdaFibra.toFixed(2)} dB
                  <br />
                 0 Emendas:{" "}
                  {perda.perdaEmendas.toFixed(2)} dB
                  <br />
                0  Conectores:{" "}
                  {perda.perdaConectores.toFixed(2)} dB
                  <br />
                0  Splitter:{" "}
                  {perda.splitterDb.toFixed(2)} dB
                </small>
              </div>
            </InfoWindow>
          )
        })()}

        {/* ================= DESENHO ================= */}
        {drawMode && (
          <DrawingManager
            options={{
              drawingControl: true,
              drawingControlOptions: {
                drawingModes: [
                  google.maps.drawing.OverlayType.POLYLINE,
                  google.maps.drawing.OverlayType.MARKER
                ]
              },
              polylineOptions: {
                strokeColor: "#ff0000",
                strokeOpacity: 0.9,
                strokeWeight: 6,
                clickable: true,
                editable: true,
                zIndex: 20
              }
            }}
            onPolylineComplete={(polyline) => {
              const path = polyline
                .getPath()
                .getArray()
                .map((p) => ({
                  lat: p.lat(),
                  lng: p.lng()
                }))

              setFibraPathTemp(path)
              setSalve(true)
              polyline.setMap(null)
            }}
          />
        )}
      </GoogleMap>
    </>
  )
}