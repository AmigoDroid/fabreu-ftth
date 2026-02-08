// components/map/useFiberEditor.ts
import { useEffect, useRef, useState } from "react"
import { CEO, FiberSegment, FiberCore } from "@/types/ftth"
import { findClosestPointOnPath, splitPathAt } from "./geoSplit"
import { gerarFibras } from "@/components/map/gerarfibras"

type LatLng = { lat: number; lng: number }
type Mode = "draw-fiber" | "place-ceo" | null

export function useFiberEditor(initialFibers: FiberSegment[]) {
  // ✅ garante que todo cabo tenha fibras (12 ABNT) mesmo em dados antigos
  const normalizeFibers = (list: FiberSegment[]) =>
    list.map((c) => ({
      ...c,
      fibras:
        (c as any).fibras && Array.isArray((c as any).fibras) && (c as any).fibras.length > 0
          ? ((c as any).fibras as FiberCore[])
          : gerarFibras(12)
    }))

  const [fiberList, setFiberList] = useState<FiberSegment[]>(
    normalizeFibers(initialFibers)
  )

  const [selectedFiber, setSelectedFiber] =
    useState<FiberSegment | null>(null)
    

  const [mode, setMode] = useState<Mode>(null)

  const [drawingMode, setDrawingMode] =
    useState<google.maps.drawing.OverlayType | null>(null)

  const [tempPath, setTempPath] = useState<LatLng[]>([])
  const [openSave, setOpenSave] = useState(false)

  // ✅ CEOs + CEO selecionada para editar
  const [ceos, setCeos] = useState<CEO[]>([])
 const [selectedCEOId, setSelectedCEOId] = useState<number | null>(null)
  const polylineRefs = useRef<Record<number, google.maps.Polyline>>({})

  // listeners de edição do path
  const editListenersRef = useRef<google.maps.MapsEventListener[]>([])

  function clearEditListeners() {
    editListenersRef.current.forEach((l) => l.remove())
    editListenersRef.current = []
  }

  function extractPath(polyline: google.maps.Polyline): LatLng[] {
    return polyline.getPath().getArray().map((p) => ({
      lat: p.lat(),
      lng: p.lng()
    }))
  }

  // =========================
  // Draw: nova fibra (cabo)
  // =========================
  function onDrawComplete(polyline: google.maps.Polyline) {
    const path = extractPath(polyline)
    setTempPath(path)
    setOpenSave(true)

    // remove overlay desenhado pelo DrawingManager
    polyline.setMap(null)

    setDrawingMode(null)
    setMode(null)
  }

  function salvarNovaFibra(form: any) {
    const total = Number(form.totalFibras ?? 12)

    setFiberList((prev) => [
      ...prev,
      {
        id: Date.now(),
        nome: form.campo1,
        descricao: form.campo2,
        caboCor: "#ff5500",
        path: tempPath,
        fibras: gerarFibras(total)
      }
    ])

    setOpenSave(false)
  }

  // =========================
  // Edit: sincroniza path em tempo real
  // =========================
  useEffect(() => {
    clearEditListeners()
    if (!selectedFiber) return

    const polyline = polylineRefs.current[selectedFiber.id]
    if (!polyline) return

    const mvcPath = polyline.getPath()

    const sync = () => {
      const novoPath = mvcPath.getArray().map((p) => ({
        lat: p.lat(),
        lng: p.lng()
      }))

      setFiberList((prev) =>
        prev.map((f) =>
          f.id === selectedFiber.id ? { ...f, path: novoPath } : f
        )
      )
    }

    sync()

    editListenersRef.current = [
      google.maps.event.addListener(mvcPath, "set_at", sync),
      google.maps.event.addListener(mvcPath, "insert_at", sync),
      google.maps.event.addListener(mvcPath, "remove_at", sync)
    ]

    return () => clearEditListeners()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiber?.id])

  function salvarEdicao() {
    if (!selectedFiber) return
    const polyline = polylineRefs.current[selectedFiber.id]
    if (!polyline) {
      setSelectedFiber(null)
      return
    }

    const novoPath = extractPath(polyline)
    setFiberList((prev) =>
      prev.map((f) =>
        f.id === selectedFiber.id ? { ...f, path: novoPath } : f
      )
    )
    setSelectedFiber(null)
  }

  // =========================
  // CEO: clicar no cabo => dividir e criar CEO
  // =========================
  function placeCEOAt(click: LatLng) {
    let best: {
      fiber: FiberSegment
      dist: number
      segIndex: number
      point: LatLng
    } | null = null

    for (const f of fiberList) {
      if (!f.path || f.path.length < 2) continue
      const closest = findClosestPointOnPath(f.path, click, 25)

      if (!best || closest.dist < best.dist) {
        best = {
          fiber: f,
          dist: closest.dist,
          segIndex: closest.segIndex,
          point: closest.point
        }
      }
    }

    if (!best) return

    // limite de snap (metros) - ajuste se quiser
    if (best.dist > 120) return

    const split = splitPathAt(best.fiber.path, {
      point: best.point,
      segIndex: best.segIndex
    })
    if (!split) return

    const baseId = Date.now()
    const caboAId = baseId
    const caboBId = baseId + 1
    const ceoId = baseId + 2

    const caboA: FiberSegment = {
      ...best.fiber,
      id: caboAId,
      nome: `${best.fiber.nome} A`,
      path: split.partA,
      fibras: best.fiber.fibras?.length ? best.fiber.fibras : gerarFibras(12)
    }

    const caboB: FiberSegment = {
      ...best.fiber,
      id: caboBId,
      nome: `${best.fiber.nome} B`,
      path: split.partB,
      fibras: best.fiber.fibras?.length ? best.fiber.fibras : gerarFibras(12)
    }

    const novaCEO: CEO = {
      id: ceoId,
      nome: "CEO",
      descricao: "Emenda",
      position: best.point,
      caboAId,
      caboBId,
      fusoes: []
    }

    setFiberList((prev) =>
      prev.filter((x) => x.id !== best!.fiber.id).concat([caboA, caboB])
    )
    setCeos((prev) => [...prev, novaCEO])

    setSelectedFiber(null)
    setMode(null)
  }

  // =========================
  // Fusões dentro da CEO
  // =========================
  function fuseFibers(ceoId: number, aFibraId: number, bFibraId: number) {
    setCeos((prev) =>
      prev.map((c) => {
        if (c.id !== ceoId) return c

        // bloqueia duplicadas: A já usada ou B já usada
        const jaTem = c.fusoes.some(
          (f) => f.aFibraId === aFibraId || f.bFibraId === bFibraId
        )
        if (jaTem) return c

        return { ...c, fusoes: [...c.fusoes, { aFibraId, bFibraId }] }
      })
    )
  }

  function unfuseFibers(ceoId: number, aFibraId: number, bFibraId: number) {
    setCeos((prev) =>
      prev.map((c) => {
        if (c.id !== ceoId) return c
        return {
          ...c,
          fusoes: c.fusoes.filter(
            (f) => !(f.aFibraId === aFibraId && f.bFibraId === bFibraId)
          )
        }
      })
    )
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

    polylineRefs,

    // CEO
    ceos,
    placeCEOAt,
    selectedCEOId,
    setSelectedCEOId,
    fuseFibers,
    unfuseFibers,

    // modo
    mode,
    setMode
  }
}