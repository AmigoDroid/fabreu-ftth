"use client"

import {
  GoogleMap,
  DrawingManager,
  useLoadScript
} from "@react-google-maps/api"

import { useEffect, useState } from "react"
import { getCurrentCoordinates } from "@/util/geolocaton"
import { PopupSalvar } from "../formInput"
import { MapToolbar } from "./MapToolbar"
import { FiberLayer } from "./FiberLayer"
import { ClientLayer } from "./ClientLayer"
import { useFiberEditor } from "./useFiberEditor"
import { Client, FiberSegment } from "@/types/ftth"
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

  const [center, setCenter] =
    useState<google.maps.LatLngLiteral | null>(null)

  const fiber = useFiberEditor(fibers)

  useEffect(() => {
    getCurrentCoordinates()
      .then((p) =>
        setCenter({ lat: p.latitude, lng: p.longitude })
      )
      .catch(() =>
        setCenter({ lat: -23.55, lng: -46.63 })
      )
  }, [])

  if (!isLoaded || !center) return <p>Carregando…</p>

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
        />
      )}

      <GoogleMap center={center} zoom={16} mapContainerStyle={{ height: "100vh" }}>
        {drawMode && (
          <DrawingManager
            drawingMode={fiber.drawingMode}
            onPolylineComplete={fiber.onDrawComplete}
            options={{ drawingControl: false }}
          />
        )}

        <ClientLayer clients={clients} />

        <FiberLayer
          fibers={fiber.fiberList}
          selectedFiber={fiber.selectedFiber}
          setSelectedFiber={fiber.setSelectedFiber}
          polylineRefs={fiber.polylineRefs}
        />
      </GoogleMap>
    </>
  )
}