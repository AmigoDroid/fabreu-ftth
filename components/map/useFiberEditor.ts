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
  SplitterRef,
  CEOSplitterRole,
  BoxKind,
  BoxFormData
} from "@/types/ftth"
import { findClosestPointOnPath, splitPathAt } from "./geoSplit"
import { gerarFibras } from "@/components/map/gerarfibras"
import type { FiberFormData } from "@/components/formInput"

type LatLng = { lat: number; lng: number }
type Mode = "draw-fiber" | "place-ceo" | "place-cto" | null

type PlacementDraft = {
  kind: BoxKind
  sourceFiberId: number
  point: LatLng
  segIndex: number
  partA: LatLng[]
  partB: LatLng[]
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

  const [openBoxSave, setOpenBoxSave] = useState(false)
  const [pendingPlacement, setPendingPlacement] = useState<PlacementDraft | null>(null)

  const polylineRefs = useRef<Record<number, google.maps.Polyline>>({})
  const editListenersRef = useRef<google.maps.MapsEventListener[]>([])
  const idRef = useRef(Date.now())

  function nextId() {
    idRef.current += 1
    return idRef.current
  }

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
      tipo: c.tipo ?? "CEO",
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

  function makeSplitter(type: CEOSplitterType, mode: CEOSplitterMode, role: CEOSplitterRole = "DEFAULT", parentLeg: number | null = null): CEOSplitter {
    const fanout = splitterFanout(type)
    const outputs = Array.from({ length: fanout }, (_, i) => ({
      leg: i + 1,
      target: null as SplitterRef | null
    }))

    const unbalanced =
      mode === "UNBALANCED"
        ? Object.fromEntries(outputs.map((o) => [o.leg, Math.round(100 / fanout)]))
        : undefined

    return {
      id: `SPL-${nextId()}`,
      type,
      mode,
      role,
      parentLeg,
      lossDb: splitterLoss(type),
      input: null,
      outputs,
      unbalanced
    }
  }

  function refKey(ref: SplitterRef) {
    return `${ref.portId}::${ref.fibraId}`
  }

  function eachUsedRef(c: CEO, cb: (ref: SplitterRef, source: string) => void) {
    for (const f of c.fusoes) {
      cb({ portId: f.a.portId, fibraId: f.a.fibraId }, `fusao-a-${f.a.portId}-${f.a.fibraId}-${f.b.portId}-${f.b.fibraId}`)
      cb({ portId: f.b.portId, fibraId: f.b.fibraId }, `fusao-b-${f.a.portId}-${f.a.fibraId}-${f.b.portId}-${f.b.fibraId}`)
    }

    for (const s of c.splitters) {
      if (s.input) cb(s.input, `splitter-in-${s.id}`)
      for (const o of s.outputs) {
        if (o.target) cb(o.target, `splitter-out-${s.id}-${o.leg}`)
      }
    }
  }

  function isRefAvailable(c: CEO, ref: SplitterRef, ignoredSources: Set<string>) {
    let available = true
    eachUsedRef(c, (r, source) => {
      if (!available) return
      if (ignoredSources.has(source)) return
      if (r.portId === ref.portId && r.fibraId === ref.fibraId) {
        available = false
      }
    })
    return available
  }

  function findPrimarySplitter(c: CEO) {
    return c.splitters.find((s) => s.role === "PRIMARY") ?? null
  }

  function findPlacementCandidate(click: LatLng) {
    let best: { fiber: FiberSegment; dist: number; segIndex: number; point: LatLng } | null = null

    for (const f of fiberList) {
      if (!f.path || f.path.length < 2) continue
      const closest = findClosestPointOnPath(f.path, click, 25)
      if (!best || closest.dist < best.dist) best = { fiber: f, dist: closest.dist, segIndex: closest.segIndex, point: closest.point }
    }

    if (!best || best.dist > 120) return null

    const split = splitPathAt(best.fiber.path, { point: best.point, segIndex: best.segIndex })
    if (!split) return null

    return {
      sourceFiberId: best.fiber.id,
      point: best.point,
      segIndex: best.segIndex,
      partA: split.partA,
      partB: split.partB
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
        id: nextId(),
        nome: form.nome,
        descricao: form.descricao,
        tipoCabo: form.tipoCabo,
        fabricante: form.fabricante,
        modelo: form.modelo,
        origem: form.origem,
        destino: form.destino,
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
  // Place box (CEO / CTO)
  // =========================
  function startPlaceBoxAt(click: LatLng, kind: BoxKind) {
    const candidate = findPlacementCandidate(click)
    if (!candidate) {
      alert("Nao foi possivel posicionar a caixa. Clique mais perto de um cabo.")
      return
    }

    setPendingPlacement({
      kind,
      sourceFiberId: candidate.sourceFiberId,
      point: candidate.point,
      segIndex: candidate.segIndex,
      partA: candidate.partA,
      partB: candidate.partB
    })
    setOpenBoxSave(true)
  }

  function cancelPlaceBox() {
    setOpenBoxSave(false)
    setPendingPlacement(null)
  }

  function salvarNovaCaixa(form: BoxFormData) {
    const draft = pendingPlacement
    if (!draft) return

    const sourceFiber = fiberList.find((f) => f.id === draft.sourceFiberId)
    if (!sourceFiber) {
      alert("O cabo selecionado nao esta mais disponivel. Tente novamente.")
      cancelPlaceBox()
      return
    }

    const caboAId = nextId()
    const caboBId = nextId()
    const ceoId = nextId()

    const fibrasOriginais = sourceFiber.fibras?.length ? sourceFiber.fibras : gerarFibras(12)

    const caboA: FiberSegment = { ...sourceFiber, id: caboAId, nome: `${sourceFiber.nome} A`, path: draft.partA, fibras: cloneFibras(fibrasOriginais) }
    const caboB: FiberSegment = { ...sourceFiber, id: caboBId, nome: `${sourceFiber.nome} B`, path: draft.partB, fibras: cloneFibras(fibrasOriginais) }

    const splitters = form.tipo === "CTO"
      ? [makeSplitter("1x8", "BALANCED", "PRIMARY", null)]
      : []

    const novaCaixa: CEO = {
      id: ceoId,
      tipo: form.tipo,
      nome: form.nome,
      codigo: form.codigo,
      fabricante: form.fabricante,
      modelo: form.modelo,
      origemSinal: form.origemSinal,
      areaAtendimento: form.areaAtendimento,
      descricao: form.descricao,
      position: draft.point,
      ports: [
        { id: "IN-1", label: "Entrada", direction: "IN", caboId: caboAId },
        { id: "OUT-1", label: "Saida 1", direction: "OUT", caboId: caboBId }
      ],
      fusoes: [],
      splitters
    }

    const cutProg = progressAlongPath(sourceFiber.path, draft.point)

    setCeos((prev) =>
      prev
        .map((c0) => {
          const c = normalizeCEO(c0)
          const ceoProg = progressAlongPath(sourceFiber.path, c.position)
          const novoId = ceoProg <= cutProg ? caboAId : caboBId

          const mudou = c.ports.some((p) => p.caboId === sourceFiber.id)
          if (!mudou) return c

          return {
            ...c,
            ports: c.ports.map((p) => (p.caboId === sourceFiber.id ? { ...p, caboId: novoId } : p))
          }
        })
        .concat([novaCaixa])
    )

    setFiberList((prev) => prev.filter((x) => x.id !== sourceFiber.id).concat([caboA, caboB]))
    setSelectedFiber(null)
    setMode(null)
    setSelectedCEOId(ceoId)
    cancelPlaceBox()
  }

  // =========================
  // CEO/CTO: portas e cabos
  // =========================
  function addOutPort(ceoId: number) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        const n = nextOutIndex(c.ports)
        return {
          ...c,
          ports: [...c.ports, { id: `OUT-${n}`, label: `Saida ${n}`, direction: "OUT", caboId: null }]
        }
      })
    )
  }

  function connectCableToPort(ceoId: number, portId: string, caboId: number | null) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

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
  // Splitters (CEO/CTO)
  // =========================
  function addSplitter(ceoId: number, type: CEOSplitterType, mode: CEOSplitterMode) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

        if (c.tipo === "CTO") {
          return c
        }

        return { ...c, splitters: [...c.splitters, makeSplitter(type, mode)] }
      })
    )
  }

  function addCTOSecondarySplitter(ceoId: number, type: "1x8" | "1x16", parentLeg: number) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        if (parentLeg < 1 || parentLeg > 8) return c

        const existsOnLeg = c.splitters.some((s) => s.role === "SECONDARY" && s.parentLeg === parentLeg)
        if (existsOnLeg) return c

        const secondary = makeSplitter(type, "BALANCED", "SECONDARY", parentLeg)
        return { ...c, splitters: [...c.splitters, secondary] }
      })
    )
  }

  function removeSplitter(ceoId: number, splitterId: string) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

        const target = c.splitters.find((s) => s.id === splitterId)
        if (!target) return c

        if (c.tipo === "CTO" && target.role === "PRIMARY") {
          return c
        }

        return { ...c, splitters: c.splitters.filter((s) => s.id !== splitterId) }
      })
    )
  }

  function setSplitterInputRef(ceoId: number, splitterId: string, ref: SplitterRef | null) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

        const ignored = new Set<string>([`splitter-in-${splitterId}`])
        if (ref && !isRefAvailable(c, ref, ignored)) return c

        return {
          ...c,
          splitters: c.splitters.map((s) => {
            if (s.id !== splitterId) return s
            if (c.tipo === "CTO" && s.role === "SECONDARY") return s
            return { ...s, input: ref }
          })
        }
      })
    )
  }

  function setSplitterOutputRef(ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

        const targetSplitter = c.splitters.find((s) => s.id === splitterId)
        if (!targetSplitter) return c

        const ignored = new Set<string>([`splitter-out-${splitterId}-${leg}`])
        if (ref && !isRefAvailable(c, ref, ignored)) return c

        if (c.tipo === "CTO" && ref && targetSplitter.role === "SECONDARY") {
          const primaryInput = findPrimarySplitter(c)?.input
          if (primaryInput && primaryInput.portId === ref.portId && primaryInput.fibraId === ref.fibraId) {
            return c
          }
        }

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
  // Fusoes normais (porta+fibra)
  // =========================
  function fuseFibers(ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) {
    if (aPortId === bPortId && aFibraId === bFibraId) return

    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c

        const jaTemPar = c.fusoes.some(
          (f) =>
            (f.a.portId === aPortId && f.a.fibraId === aFibraId && f.b.portId === bPortId && f.b.fibraId === bFibraId) ||
            (f.a.portId === bPortId && f.a.fibraId === bFibraId && f.b.portId === aPortId && f.b.fibraId === aFibraId)
        )
        if (jaTemPar) return c

        const refA: SplitterRef = { portId: aPortId, fibraId: aFibraId }
        const refB: SplitterRef = { portId: bPortId, fibraId: bFibraId }

        const availableA = isRefAvailable(c, refA, new Set<string>())
        const availableB = isRefAvailable(c, refB, new Set<string>())
        if (!availableA || !availableB) return c

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

    openBoxSave,
    setOpenBoxSave,
    pendingPlacement,
    salvarNovaCaixa,
    cancelPlaceBox,

    polylineRefs,

    ceos,
    startPlaceBoxAt,
    selectedCEOId,
    setSelectedCEOId,

    addOutPort,
    connectCableToPort,
    disconnectCableFromPort,

    fuseFibers,
    unfuseFibers,

    addSplitter,
    addCTOSecondarySplitter,
    removeSplitter,
    setSplitterInputRef,
    setSplitterOutputRef,
    setSplitterLegUnbalanced,

    mode,
    setMode
  }
}
