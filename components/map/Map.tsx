// components/map/Map.tsx
"use client"

import { GoogleMap, DrawingManager, useLoadScript } from "@react-google-maps/api"
import { useEffect, useState } from "react"
import { getCurrentCoordinates } from "@/util/geolocaton"
import { PopupSalvar } from "../formInput"
import { PopupSalvarCaixa } from "../boxFormPopup"
import { MapToolbar } from "./MapToolbar"
import { FiberLayer } from "./FiberLayer"
import { ClientLayer } from "./ClientLayer"
import { CEOLayer } from "./CEOLayer"
import { useFiberEditor } from "./useFiberEditor"
import { Client, FiberSegment } from "@/types/ftth"
import { CEOEditor } from "./CEOEditor"
import { CTOEditor } from "./CTOEditor"

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

  if (!isLoaded || !center) return <p>Carregando...</p>

  const caixaSelecionada =
    fiber.selectedCEOId != null
      ? fiber.ceos.find((c) => c.id === fiber.selectedCEOId) ?? null
      : null

  const selectedKind = fiber.pendingPlacement?.kind ?? "CEO"

  return (
    <>
      <PopupSalvar
        open={fiber.openSave}
        onSalvar={fiber.salvarNovaFibra}
        onCancelar={() => fiber.setOpenSave(false)}
      />

      <PopupSalvarCaixa
        open={fiber.openBoxSave}
        kind={selectedKind}
        onSalvar={fiber.salvarNovaCaixa}
        onCancelar={fiber.cancelPlaceBox}
      />

      {drawMode && (
        <MapToolbar
          setDrawingMode={fiber.setDrawingMode}
          setMode={fiber.setMode}
          mode={fiber.mode}
        />
      )}

      {caixaSelecionada && caixaSelecionada.tipo === "CEO" && (
        <CEOEditor
          ceo={caixaSelecionada}
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

      {caixaSelecionada && caixaSelecionada.tipo === "CTO" && (
        <CTOEditor
          ceo={caixaSelecionada}
          fibers={fiber.fiberList}
          onClose={() => fiber.setSelectedCEOId(null)}
          onAddOutPort={fiber.addOutPort}
          onConnectCable={fiber.connectCableToPort}
          onFuse={fiber.fuseFibers}
          onUnfuse={fiber.unfuseFibers}
          onAddCTOPrimarySplitter={fiber.addCTOPrimarySplitter}
          onSetSplitterInputRef={fiber.setSplitterInputRef}
          onSetSplitterOutputRef={fiber.setSplitterOutputRef}
          onAddCTOSecondarySplitter={fiber.addCTOSecondarySplitter}
          onRemoveSplitter={fiber.removeSplitter}
        />
      )}

      <GoogleMap
        center={center}
        zoom={16}
        mapContainerStyle={{ height: "100vh" }}
        onClick={(e) => {
          if (fiber.mode !== "place-ceo" && fiber.mode !== "place-cto") return
          // Posicionamento de caixa agora acontece clicando diretamente no cabo.
          void e
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
          onSaveEdit={fiber.salvarEdicao}
          mode={fiber.mode}
          onRequestPlaceBox={(click, sourceFiberId) => {
            if (fiber.mode !== "place-ceo" && fiber.mode !== "place-cto") return
            const kind = fiber.mode === "place-cto" ? "CTO" : "CEO"
            fiber.startPlaceBoxAt(click, kind, sourceFiberId)
          }}
        />
      </GoogleMap>
    </>
  )
}

