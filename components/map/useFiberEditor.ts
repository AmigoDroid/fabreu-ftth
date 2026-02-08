// components/map/useFiberEditor.ts
import { useRef, useState } from "react"
import { FiberSegment } from "@/types/ftth"

export function useFiberEditor(initialFibers: FiberSegment[]) {
  const [fiberList, setFiberList] =
    useState<FiberSegment[]>(initialFibers)

  const [selectedFiber, setSelectedFiber] =
    useState<FiberSegment | null>(null)

  const [drawingMode, setDrawingMode] =
    useState<google.maps.drawing.OverlayType | null>(null)

  const [tempPath, setTempPath] =
    useState<{ lat: number; lng: number }[]>([])

  const [openSave, setOpenSave] = useState(false)

  const polylineRefs =
    useRef<Record<number, google.maps.Polyline>>({})

  function onDrawComplete(polyline: google.maps.Polyline) {
    const path = polyline
      .getPath()
      .getArray()
      .map((p) => ({
        lat: p.lat(),
        lng: p.lng()
      }))

    setTempPath(path)
    setOpenSave(true)
    polyline.setMap(null)
    setDrawingMode(null)
  }

  function salvarNovaFibra(form: any) {
    setFiberList((prev) => [
      ...prev,
      {
        id: Date.now(),
        nome: form.campo1,
        descricao: form.campo2,
        color: "#ff5500",
        path: tempPath
      }
    ])
    setOpenSave(false)
  }

  function salvarEdicao() {
    if (!selectedFiber) return
    const polyline =
      polylineRefs.current[selectedFiber.id]
    if (!polyline) return

    const novoPath = polyline
      .getPath()
      .getArray()
      .map((p) => ({
        lat: p.lat(),
        lng: p.lng()
      }))

    setFiberList((prev) =>
      prev.map((f) =>
        f.id === selectedFiber.id
          ? { ...f, path: novoPath }
          : f
      )
    )
    setSelectedFiber(null)
  }

  return {
    fiberList,
    selectedFiber,
    setSelectedFiber,
    drawingMode,
    setDrawingMode,
    onDrawComplete,
    salvarNovaFibra,
    salvarEdicao,
    openSave,
    setOpenSave,
    polylineRefs
  }
}