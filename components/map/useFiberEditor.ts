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
        (c as any).fibras &&
        Array.isArray((c as any).fibras) &&
        (c as any).fibras.length > 0
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
  // Helpers: progresso no cabo
  // =========================
  function dist(a: LatLng, b: LatLng) {
    return google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(a.lat, a.lng),
      new google.maps.LatLng(b.lat, b.lng)
    )
  }

  function progressAlongPath(path: LatLng[], point: LatLng) {
    const closest = findClosestPointOnPath(path, point, 25)

    let total = 0
    for (let i = 0; i < closest.segIndex; i++) {
      total += dist(path[i], path[i + 1])
    }

    const segLen = dist(path[closest.segIndex], path[closest.segIndex + 1])

    const a = new google.maps.LatLng(
      path[closest.segIndex].lat,
      path[closest.segIndex].lng
    )
    const p = new google.maps.LatLng(closest.point.lat, closest.point.lng)

    const walked = segLen > 0 ? google.maps.geometry.spherical.computeDistanceBetween(a, p) : 0
    const t = segLen > 0 ? walked / segLen : 0

    return total + segLen * Math.max(0, Math.min(1, t))
  }

  function cloneFibras(fibras: FiberCore[]) {
    return fibras.map((x) => ({
      ...x,
      fibraFusionadaCom: x.fibraFusionadaCom ?? null
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
  // CEO: clicar no cabo => dividir e criar CEO (suporta várias CEOs)
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

    // limite de snap (metros)
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

    const fibrasOriginais =
      best.fiber.fibras?.length ? best.fiber.fibras : gerarFibras(12)

    const caboA: FiberSegment = {
      ...best.fiber,
      id: caboAId,
      nome: `${best.fiber.nome} A`,
      path: split.partA,
      fibras: cloneFibras(fibrasOriginais)
    }

    const caboB: FiberSegment = {
      ...best.fiber,
      id: caboBId,
      nome: `${best.fiber.nome} B`,
      path: split.partB,
      fibras: cloneFibras(fibrasOriginais)
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

    // ✅ progresso do ponto de corte no cabo antigo
    const cutProg = progressAlongPath(best.fiber.path, best.point)

    // ✅ atualiza CEOs antigas que referenciavam esse cabo (pra não quebrar)
    setCeos((prev) =>
      prev
        .map((c) => {
          const usaA = c.caboAId === best!.fiber.id
          const usaB = c.caboBId === best!.fiber.id
          if (!usaA && !usaB) return c

          const ceoProg = progressAlongPath(best!.fiber.path, c.position)
          const novoId = ceoProg <= cutProg ? caboAId : caboBId

          if (usaA) return { ...c, caboAId: novoId }
          return { ...c, caboBId: novoId }
        })
        .concat([novaCEO])
    )

    // remove cabo antigo e adiciona os 2 novos
    setFiberList((prev) =>
      prev.filter((x) => x.id !== best!.fiber.id).concat([caboA, caboB])
    )

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