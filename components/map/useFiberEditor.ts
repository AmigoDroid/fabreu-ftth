// components/map/useFiberEditor.ts
import { useEffect, useRef, useState } from "react"
import {
  CEO,
  FiberSegment,
  FiberCore,
  CEOPort,
  CEOFusion,
  CEOSplitter,
  CEOSplitterMode,
  CEOSplitterType,
  SplitterRef
} from "@/types/ftth"
import { findClosestPointOnPath, splitPathAt } from "./geoSplit"
import { gerarFibras } from "@/components/map/gerarfibras"

type LatLng = { lat: number; lng: number }
type Mode = "draw-fiber" | "place-ceo" | null

type FiberFormData = {
  campo1: string
  campo2: string
  totalFibras?: number
}

export function useFiberEditor(initialFibers: FiberSegment[]) {
  const normalizeFibers = (list: FiberSegment[]) =>
    list.map((c) => ({
      ...c,
      fibras:
        c.fibras &&
        Array.isArray(c.fibras) &&
        c.fibras.length > 0
          ? c.fibras
          : gerarFibras(12)
    }))

  const [fiberList, setFiberList] = useState<FiberSegment[]>(
    normalizeFibers(initialFibers)
  )

  const [selectedFiber, setSelectedFiber] = useState<FiberSegment | null>(null)
  const [mode, setMode] = useState<Mode>(null)

  const [drawingMode, setDrawingMode] =
    useState<google.maps.drawing.OverlayType | null>(null)

  const [tempPath, setTempPath] = useState<LatLng[]>([])
  const [openSave, setOpenSave] = useState(false)

  const [ceos, setCeos] = useState<CEO[]>([])
  const [selectedCEOId, setSelectedCEOId] = useState<number | null>(null)

  const polylineRefs = useRef<Record<number, google.maps.Polyline>>({})
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

  function dist(a: LatLng, b: LatLng) {
    return google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(a.lat, a.lng),
      new google.maps.LatLng(b.lat, b.lng)
    )
  }

  function progressAlongPath(path: LatLng[], point: LatLng) {
    const closest = findClosestPointOnPath(path, point, 25)

    let total = 0
    for (let i = 0; i < closest.segIndex; i++) total += dist(path[i], path[i + 1])

    const segLen = dist(path[closest.segIndex], path[closest.segIndex + 1])

    const a = new google.maps.LatLng(path[closest.segIndex].lat, path[closest.segIndex].lng)
    const p = new google.maps.LatLng(closest.point.lat, closest.point.lng)

    const walked = segLen > 0 ? google.maps.geometry.spherical.computeDistanceBetween(a, p) : 0
    const t = segLen > 0 ? walked / segLen : 0
    return total + segLen * Math.max(0, Math.min(1, t))
  }

  function cloneFibras(fibras: FiberCore[]) {
    return fibras.map((x) => ({
      ...x
    }))
  }

  function nextOutIndex(ports: CEOPort[]) {
    const outs = ports
      .filter((p) => p.direction === "OUT")
      .map((p) => Number(p.id.replace("OUT-", "")))
      .filter((n) => Number.isFinite(n))
    const max = outs.length ? Math.max(...outs) : 0
    return max + 1
  }

  function normalizeCEO(c: CEO): CEO {
    return {
      ...c,
      ports: Array.isArray(c.ports) ? c.ports : [],
      fusoes: Array.isArray(c.fusoes) ? c.fusoes : [],
      splitters: Array.isArray(c.splitters) ? c.splitters : []
    }
  }

  function splitterFanout(type: CEOSplitterType) {
    switch (type) {
      case "1x2": return 2
      case "1x4": return 4
      case "1x8": return 8
      case "1x16": return 16
    }
  }

  function splitterLoss(type: CEOSplitterType) {
    switch (type) {
      case "1x2": return 3.6
      case "1x4": return 7.2
      case "1x8": return 10.5
      case "1x16": return 13.5
    }
  }

  // =========================
  // Draw: novo cabo
  // =========================
  function onDrawComplete(polyline: google.maps.Polyline) {
    const path = extractPath(polyline)
    setTempPath(path)
    setOpenSave(true)
    polyline.setMap(null)
    setDrawingMode(null)
    setMode(null)
  }

  function salvarNovaFibra(form: FiberFormData) {
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
  // Edit path realtime
  // =========================
  useEffect(() => {
    clearEditListeners()
    if (!selectedFiber) return

    const polyline = polylineRefs.current[selectedFiber.id]
    if (!polyline) return

    const mvcPath = polyline.getPath()

    const sync = () => {
      const novoPath = mvcPath.getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }))
      setFiberList((prev) => prev.map((f) => (f.id === selectedFiber.id ? { ...f, path: novoPath } : f)))
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
    setFiberList((prev) => prev.map((f) => (f.id === selectedFiber.id ? { ...f, path: novoPath } : f)))
    setSelectedFiber(null)
  }

  // =========================
  // CEO: portas e cabos
  // =========================
  function addOutPort(ceoId: number) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        const n = nextOutIndex(c.ports)
        return {
          ...c,
          ports: [...c.ports, { id: `OUT-${n}`, label: `Saída ${n}`, direction: "OUT", caboId: null }]
        }
      })
    )
  }

  function connectCableToPort(ceoId: number, portId: string, caboId: number | null) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

        // se desconectar, apaga fusões que usavam essa porta
        const nextPorts = c.ports.map((p) => (p.id === portId ? { ...p, caboId } : p))
        const nextFusoes = caboId == null
          ? c.fusoes.filter((f) => f.a.portId !== portId && f.b.portId !== portId)
          : c.fusoes

        const nextSplitters = caboId == null
          ? c.splitters.map((s) => ({
              ...s,
              input: s.input?.portId === portId ? null : s.input,
              outputs: s.outputs.map((o) => (o.target?.portId === portId ? { ...o, target: null } : o))
            }))
          : c.splitters

        return { ...c, ports: nextPorts, fusoes: nextFusoes, splitters: nextSplitters }
      })
    )
  }

  function disconnectCableFromPort(ceoId: number, portId: string) {
    connectCableToPort(ceoId, portId, null)
  }

  // =========================
  // CEO: SPLITTERS
  // =========================
  function addSplitter(ceoId: number, type: CEOSplitterType, mode: CEOSplitterMode) {
    const fanout = splitterFanout(type)

    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

        const outputs = Array.from({ length: fanout }, (_, i) => ({
          leg: i + 1,
          target: null as SplitterRef | null
        }))

        const unbalanced =
          mode === "UNBALANCED"
            ? Object.fromEntries(outputs.map((o) => [o.leg, Math.round(100 / fanout)]))
            : undefined

        const s: CEOSplitter = {
          id: `SPL-${Date.now()}`,
          type,
          mode,
          lossDb: splitterLoss(type),
          input: null,
          outputs,
          unbalanced
        }

        return { ...c, splitters: [...c.splitters, s] }
      })
    )
  }

  function removeSplitter(ceoId: number, splitterId: string) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        return { ...c, splitters: c.splitters.filter((s) => s.id !== splitterId) }
      })
    )
  }

  function setSplitterInputRef(ceoId: number, splitterId: string, ref: SplitterRef | null) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        return {
          ...c,
          splitters: c.splitters.map((s) => (s.id === splitterId ? { ...s, input: ref } : s))
        }
      })
    )
  }

  function setSplitterOutputRef(ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        return {
          ...c,
          splitters: c.splitters.map((s) => {
            if (s.id !== splitterId) return s
            return {
              ...s,
              outputs: s.outputs.map((o) => (o.leg === leg ? { ...o, target: ref } : o))
            }
          })
        }
      })
    )
  }

  function setSplitterLegUnbalanced(ceoId: number, splitterId: string, leg: number, percent: number) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        return {
          ...c,
          splitters: c.splitters.map((s) => {
            if (s.id !== splitterId) return s
            if (s.mode !== "UNBALANCED") return s
            return { ...s, unbalanced: { ...(s.unbalanced ?? {}), [leg]: percent } }
          })
        }
      })
    )
  }

  // =========================
  // CEO: criar CEO ao cortar cabo
  // =========================
  function placeCEOAt(click: LatLng) {
    let best: { fiber: FiberSegment; dist: number; segIndex: number; point: LatLng } | null = null

    for (const f of fiberList) {
      if (!f.path || f.path.length < 2) continue
      const closest = findClosestPointOnPath(f.path, click, 25)
      if (!best || closest.dist < best.dist) best = { fiber: f, dist: closest.dist, segIndex: closest.segIndex, point: closest.point }
    }

    if (!best) return
    if (best.dist > 120) return

    const split = splitPathAt(best.fiber.path, { point: best.point, segIndex: best.segIndex })
    if (!split) return

    const baseId = Date.now()
    const caboAId = baseId
    const caboBId = baseId + 1
    const ceoId = baseId + 2

    const fibrasOriginais = best.fiber.fibras?.length ? best.fiber.fibras : gerarFibras(12)

    const caboA: FiberSegment = { ...best.fiber, id: caboAId, nome: `${best.fiber.nome} A`, path: split.partA, fibras: cloneFibras(fibrasOriginais) }
    const caboB: FiberSegment = { ...best.fiber, id: caboBId, nome: `${best.fiber.nome} B`, path: split.partB, fibras: cloneFibras(fibrasOriginais) }

    const novaCEO: CEO = {
      id: ceoId,
      nome: "CEO",
      descricao: "Emenda / Derivação",
      position: best.point,
      ports: [
        { id: "IN-1", label: "Entrada", direction: "IN", caboId: caboAId },
        { id: "OUT-1", label: "Saída 1", direction: "OUT", caboId: caboBId }
      ],
      fusoes: [],
      splitters: []
    }

    const cutProg = progressAlongPath(best.fiber.path, best.point)

    setCeos((prev) =>
      prev
        .map((c0) => {
          const c = normalizeCEO(c0)
          const ceoProg = progressAlongPath(best!.fiber.path, c.position)
          const novoId = ceoProg <= cutProg ? caboAId : caboBId

          const mudou = c.ports.some((p) => p.caboId === best!.fiber.id)
          if (!mudou) return c

          return {
            ...c,
            ports: c.ports.map((p) => (p.caboId === best!.fiber.id ? { ...p, caboId: novoId } : p))
          }
        })
        .concat([novaCEO])
    )

    setFiberList((prev) => prev.filter((x) => x.id !== best!.fiber.id).concat([caboA, caboB]))
    setSelectedFiber(null)
    setMode(null)
  }

  // =========================
  // Fusões normais (porta+fibra)
  // =========================
  function fuseFibers(ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

        const jaTem = c.fusoes.some(
          (f) =>
            (f.a.portId === aPortId && f.a.fibraId === aFibraId) ||
            (f.b.portId === bPortId && f.b.fibraId === bFibraId)
        )
        if (jaTem) return c

        const nova: CEOFusion = { a: { portId: aPortId, fibraId: aFibraId }, b: { portId: bPortId, fibraId: bFibraId } }
        return { ...c, fusoes: [...c.fusoes, nova] }
      })
    )
  }

  function unfuseFibers(ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        return {
          ...c,
          fusoes: c.fusoes.filter(
            (f) =>
              !(
                f.a.portId === aPortId &&
                f.a.fibraId === aFibraId &&
                f.b.portId === bPortId &&
                f.b.fibraId === bFibraId
              )
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

    ceos,
    placeCEOAt,
    selectedCEOId,
    setSelectedCEOId,

    addOutPort,
    connectCableToPort,
    disconnectCableFromPort,

    fuseFibers,
    unfuseFibers,

    // splitter
    addSplitter,
    removeSplitter,
    setSplitterInputRef,
    setSplitterOutputRef,
    setSplitterLegUnbalanced,

    mode,
    setMode
  }
}