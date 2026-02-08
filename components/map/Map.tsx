// components/map/Map.tsx
"use client"

import { GoogleMap, DrawingManager, useLoadScript } from "@react-google-maps/api"
import { useEffect, useState } from "react"
import { getCurrentCoordinates } from "@/util/geolocaton"
import { PopupSalvar } from "../formInput"
import { MapToolbar } from "./MapToolbar"
import { FiberLayer } from "./FiberLayer"
import { ClientLayer } from "./ClientLayer"
import { CEOLayer } from "./CEOLayer"
import { useFiberEditor } from "./useFiberEditor"
import { Client, FiberSegment } from "@/types/ftth"
import { CEOEditor } from "./CEOEditor"

type Props = {
  clients: Client[]
  fibers: FiberSegment[]
  drawMode?: boolean
}

export default function Map({ clients, fibers, drawMode = false }: Props) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries: ["drawing", "geometry"]
  })

  const [center, setCenter] = useState<google.maps.LatLngLiteral | null>(null)
  const fiber = useFiberEditor(fibers)

  useEffect(() => {
    getCurrentCoordinates()
      .then((p) => setCenter({ lat: p.latitude, lng: p.longitude }))
      .catch(() => setCenter({ lat: -23.55, lng: -46.63 }))
  }, [])

  if (!isLoaded || !center) return <p>Carregando…</p>

  const ceoSelecionada =
    fiber.selectedCEOId != null
      ? fiber.ceos.find((c) => c.id === fiber.selectedCEOId) ?? null
      : null

  return (
    <>
      <PopupSalvar
        open={fiber.openSave}
        onSalvar={fiber.salvarNovaFibra}
        onCancelar={() => fiber.setOpenSave(false)}
        onContinuar={() => fiber.setOpenSave(false)}
      />

      {drawMode && (
        <MapToolbar
          setDrawingMode={fiber.setDrawingMode}
          onSave={fiber.salvarEdicao}
          disabledSave={!fiber.selectedFiber}
          setMode={fiber.setMode}
        />
      )}

      {ceoSelecionada && (
        <CEOEditor
          ceo={ceoSelecionada}
          fibers={fiber.fiberList}
          onClose={() => fiber.setSelectedCEOId(null)}
          onAddOutPort={fiber.addOutPort}
          onConnectCable={fiber.connectCableToPort}
          onFuse={fiber.fuseFibers}
          onUnfuse={fiber.unfuseFibers}
          onAddSplitter={fiber.addSplitter}
          onRemoveSplitter={fiber.removeSplitter}
          onSetSplitterInputRef={fiber.setSplitterInputRef}
          onSetSplitterOutputRef={fiber.setSplitterOutputRef}
          onSetSplitterLegUnbalanced={fiber.setSplitterLegUnbalanced}
        />
      )}

      <GoogleMap
        center={center}
        zoom={16}
        mapContainerStyle={{ height: "100vh" }}
        onClick={(e) => {
          if (fiber.mode !== "place-ceo") return
          const lat = e.latLng?.lat()
          const lng = e.latLng?.lng()
          if (lat == null || lng == null) return
          fiber.placeCEOAt({ lat, lng })
        }}
      >
        {drawMode && (
          <DrawingManager
            drawingMode={fiber.drawingMode}
            onPolylineComplete={fiber.onDrawComplete}
            options={{ drawingControl: false }}
          />
        )}

        <ClientLayer clients={clients} />

        <CEOLayer ceos={fiber.ceos} onSelectCEO={(c) => fiber.setSelectedCEOId(c.id)} />

        <FiberLayer
          fibers={fiber.fiberList}
          selectedFiber={fiber.selectedFiber}
          ceos={fiber.ceos}
          setSelectedFiber={fiber.setSelectedFiber}
          polylineRefs={fiber.polylineRefs}
        />
      </GoogleMap>
    </>
  )
}