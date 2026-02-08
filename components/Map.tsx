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
    libraries: drawMode ? ["drawing"] : []
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
        setMapCenter({ lat: -23.55052, lng: -46.633308 }) // fallback
      })
  }, [])

  if (!isLoaded || !mapCenter) {
    return <p>Carregando mapa...</p>
  }

  /* ================= FUNÇÃO AUXILIAR ================= */
  function getFiberCenter(path: { lat: number; lng: number }[]) {
    const middleIndex = Math.floor(path.length / 2)
    return path[middleIndex]
  }

  return (
    <>
      {/* =============== POPUP DE SALVAR FIBRA =============== */}
      <PopupSalvar
        open={salve}
        onSalvar={(form) => {
          setFiberList((prev) => [
            ...prev,
            {
              id: Date.now(),
              nome: form.campo1,
              descricao: form.campo2,
              color: "black",
              path: [...fibraPathTemp]
            }
          ])
          setSalve(false)
        }}
        onContinuar={() => setSalve(false)}
        onCancelar={() => setSalve(false)}
      />

      {/* ======================= MAPA ======================= */}
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

        {/* INFO CLIENTE */}
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
        {fiberList.map((f) => (
          <Polyline
            key={f.id}
            path={f.path}
            options={{
              strokeColor: f.color,
              strokeWeight: 5,
              clickable: true,
              zIndex: 10
            }}
            onClick={() => {
              f.color = "green" // muda cor para destacar
              setSelectedFiber(f)
              setSelectedClient(null)
            }}
          />
        ))}

        {/* INFO FIBRA */}
        {selectedFiber && (
          <InfoWindow
          
            position={getFiberCenter(selectedFiber.path)}
            onCloseClick={() => {
              selectedFiber.color = "black"
              setSelectedFiber(null)
            }}
          >
            <div>
              <strong>Fibra: {selectedFiber.nome}</strong>
              <br />
              Pontos: {selectedFiber.path.length}
            </div>
          </InfoWindow>
        )}

        {/* ================= MODO DESENHO ================= */}
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
              polyline.setMap(null) // remove o desenho temporário
            }}
          />
        )}
      </GoogleMap>
    </>
  )
}