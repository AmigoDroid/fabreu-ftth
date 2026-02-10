// components/map/useFiberEditor.ts
import { useRef, useState } from "react"
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
  BoxFormData,
  CTOCableTubeSize,
  CTODropStatus,
  CTOTerminationType,
  CTOConnectorType,
  OLTGbicClass,
  OLTSignalProfile
} from "@/types/ftth"
import { findClosestPointOnPath, splitPathAt } from "./geoSplit"
import { gerarFibras } from "@/components/map/gerarfibras"
import type { FiberFormData } from "@/components/formInput"

type LatLng = { lat: number; lng: number }
type Mode = "draw-fiber" | "place-pop" | "place-ceo" | "place-cto" | "place-olt" | "place-dio" | "place-cliente" | null

type ActiveSignalSource = {
  nodeId: number
  portId: string
  fibraId: number
  label: string
} | null

type PlacementDraft = {
  kind: BoxKind
  sourceFiberId: number
  point: LatLng
  segIndex: number
  partA: LatLng[]
  partB: LatLng[]
}

export function useFiberEditor(initialFibers: FiberSegment[], activeProjectId: string, activeCity: string, activePop: string) {
  const normalizeFibers = (list: FiberSegment[]) =>
    list.map((c) => ({
      ...c,
      projectId: c.projectId ?? "project-default",
      city: c.city ?? "Cidade Base",
      pop: c.pop ?? "POP Central",
      tubeCount: Math.max(1, c.tubeCount ?? 1),
      fibersPerTube: Math.max(1, c.fibersPerTube ?? 12),
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
  const [activeSignalSource, setActiveSignalSource] = useState<ActiveSignalSource>(null)

  const [openBoxSave, setOpenBoxSave] = useState(false)
  const [pendingPlacement, setPendingPlacement] = useState<PlacementDraft | null>(null)

  const polylineRefs = useRef<Record<number, google.maps.Polyline>>({})
  const seedId = initialFibers.reduce((max, f) => (f.id > max ? f.id : max), 0) + 1000
  const idRef = useRef(seedId)

  function nextId() {
    idRef.current += 1
    return idRef.current
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

  function ensureTubeConfig(total: number, rawTubeCount?: number, rawFibersPerTube?: number) {
    const safeTotal = Math.max(1, Math.floor(total))
    const fibersPerTube = Math.max(1, Math.floor(rawFibersPerTube ?? 12))
    const minTubeCount = Math.max(1, Math.ceil(safeTotal / fibersPerTube))
    const tubeCount = Math.max(minTubeCount, Math.floor(rawTubeCount ?? minTubeCount))
    return { tubeCount, fibersPerTube }
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
      projectId: c.projectId ?? "project-default",
      city: c.city ?? "Cidade Base",
      pop: c.pop ?? "POP Central",
      tipo: c.tipo ?? "CEO",
      ports: Array.isArray(c.ports) ? c.ports : [],
      fusoes: Array.isArray(c.fusoes) ? c.fusoes : [],
      splitters: Array.isArray(c.splitters) ? c.splitters : [],
      ctoModel: c.tipo === "CTO"
        ? {
            cableTubes: Array.isArray(c.ctoModel?.cableTubes) ? c.ctoModel!.cableTubes : [],
            drops: Array.isArray(c.ctoModel?.drops) ? c.ctoModel!.drops : [],
            legConfigs: Array.isArray(c.ctoModel?.legConfigs) ? c.ctoModel!.legConfigs : [],
            splitterConfigs: Array.isArray(c.ctoModel?.splitterConfigs) ? c.ctoModel!.splitterConfigs : [],
            explicitlyUnfed: Boolean(c.ctoModel?.explicitlyUnfed)
          }
        : c.ctoModel,
      oltModel: c.tipo === "OLT"
        ? {
            slots: Array.isArray(c.oltModel?.slots) ? c.oltModel!.slots.map((slot) => ({
              ...slot,
              pons: Array.isArray(slot.pons) ? slot.pons : []
            })) : []
          }
        : c.oltModel,
      dioModel: c.tipo === "DIO"
        ? {
            cityTag: c.dioModel?.cityTag ?? ""
          }
        : c.dioModel
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

  function findPlacementCandidate(click: LatLng, sourceFiberId?: number) {
    let best: { fiber: FiberSegment; dist: number; segIndex: number; point: LatLng } | null = null

    const candidates = sourceFiberId != null ? fiberList.filter((f) => f.id === sourceFiberId) : fiberList
    for (const f of candidates) {
      if (!f.path || f.path.length < 2) continue
      const closest = findClosestPointOnPath(f.path, click, 25)
      if (!best || closest.dist < best.dist) best = { fiber: f, dist: closest.dist, segIndex: closest.segIndex, point: closest.point }
    }

    if (!best) return null
    if (sourceFiberId == null && best.dist > 120) return null

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
    const tubeCfg = ensureTubeConfig(total, form.tubeCount, form.fibersPerTube)
    setFiberList((prev) => [
      ...prev,
      {
        id: nextId(),
        projectId: activeProjectId,
        city: activeCity,
        pop: activePop,
        nome: form.nome,
        descricao: form.descricao,
        tipoCabo: form.tipoCabo,
        tubeCount: tubeCfg.tubeCount,
        fibersPerTube: tubeCfg.fibersPerTube,
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
  function startPlaceBoxAt(click: LatLng, kind: BoxKind, sourceFiberId?: number) {
    const candidate = findPlacementCandidate(click, sourceFiberId)
    if (!candidate) {
      alert("Nao foi possivel posicionar a caixa. Clique mais perto de um cabo.")
      return
    }

    setPendingPlacement({
      kind,
      sourceFiberId: candidate.sourceFiberId,
      point: sourceFiberId != null ? click : candidate.point,
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

    const baseTubeCfg = ensureTubeConfig(
      fibrasOriginais.length,
      sourceFiber.tubeCount,
      sourceFiber.fibersPerTube
    )
    const caboA: FiberSegment = {
      ...sourceFiber,
      id: caboAId,
      nome: `${sourceFiber.nome} A`,
      path: draft.partA,
      fibras: cloneFibras(fibrasOriginais),
      tubeCount: baseTubeCfg.tubeCount,
      fibersPerTube: baseTubeCfg.fibersPerTube
    }
    const caboB: FiberSegment = {
      ...sourceFiber,
      id: caboBId,
      nome: `${sourceFiber.nome} B`,
      path: draft.partB,
      fibras: cloneFibras(fibrasOriginais),
      tubeCount: baseTubeCfg.tubeCount,
      fibersPerTube: baseTubeCfg.fibersPerTube
    }

    const splitters: CEOSplitter[] = []
    const defaultPorts: CEOPort[] = [
      { id: "IN-1", label: "Entrada", direction: "IN", caboId: caboAId },
      { id: "OUT-1", label: "Saida 1", direction: "OUT", caboId: caboBId }
    ]

    const typeLabel = form.tipo === "CLIENTE" ? "Cliente" : form.tipo
    const ports = defaultPorts

    const novaCaixa: CEO = {
      id: ceoId,
      projectId: sourceFiber.projectId ?? activeProjectId,
      city: sourceFiber.city ?? activeCity,
      pop: sourceFiber.pop ?? activePop,
      tipo: form.tipo,
      nome: form.nome || `${typeLabel}-${ceoId}`,
      codigo: form.codigo,
      fabricante: form.fabricante,
      modelo: form.modelo,
      origemSinal: form.origemSinal,
      areaAtendimento: form.areaAtendimento,
      descricao: form.descricao,
      position: draft.point,
      ports,
      fusoes: [],
      splitters,
      ctoModel: form.tipo === "CTO" ? { cableTubes: [], drops: [], legConfigs: [], splitterConfigs: [], explicitlyUnfed: false } : undefined
      ,
      oltModel: form.tipo === "OLT" ? { slots: [] } : undefined,
      dioModel: form.tipo === "DIO" ? { cityTag: form.areaAtendimento || "" } : undefined
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

        const nextCtoModel = c.ctoModel
          ? {
              ...c.ctoModel,
              drops: c.ctoModel.drops.map((d) => ({
                ...d,
                target: d.target?.portId === portId ? null : d.target
              }))
            }
          : c.ctoModel

        return { ...c, ports: nextPorts, fusoes: nextFusoes, splitters: nextSplitters, ctoModel: nextCtoModel }
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

  function addCTOPrimarySplitter(ceoId: number) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        const hasPrimary = c.splitters.some((s) => s.role === "PRIMARY")
        if (hasPrimary) return c
        return { ...c, splitters: [...c.splitters, makeSplitter("1x8", "BALANCED", "PRIMARY", null)] }
      })
    )
  }

  function addCTOSecondarySplitter(
    ceoId: number,
    type: "1x8" | "1x16",
    parentLeg: number | null,
    mode: CEOSplitterMode = "BALANCED",
    connectorized = true,
    connectorType: CTOConnectorType = "APC",
    docs?: Partial<{
      docName: string
      docCode: string
      docModel: string
      docNotes: string
    }>
  ) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        if (parentLeg != null && (parentLeg < 1 || parentLeg > 8)) return c

        const existsOnLeg = parentLeg != null && c.splitters.some((s) => s.role === "SECONDARY" && s.parentLeg === parentLeg)
        if (existsOnLeg) return c

        const secondary = makeSplitter(type, mode, "SECONDARY", parentLeg)
        const model = ensureCtoModel(c)
        return {
          ...c,
          splitters: [...c.splitters, secondary],
          ctoModel: {
            ...model,
            splitterConfigs: [
              ...(model.splitterConfigs ?? []),
              { splitterId: secondary.id, connectorized, connectorType, ...docs }
            ]
          }
        }
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

        return {
          ...c,
          splitters: c.splitters.filter((s) => s.id !== splitterId),
          ctoModel: c.ctoModel
            ? {
                ...c.ctoModel,
                drops: c.ctoModel.drops.filter((d) => d.splitterId !== splitterId),
                legConfigs: (c.ctoModel.legConfigs ?? []).filter((x) => x.splitterId !== splitterId),
                splitterConfigs: (c.ctoModel.splitterConfigs ?? []).filter((x) => x.splitterId !== splitterId)
              }
            : c.ctoModel
        }
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

  function ensureCtoModel(c: CEO) {
    if (c.ctoModel) return c.ctoModel
    return { cableTubes: [], drops: [], legConfigs: [], splitterConfigs: [], explicitlyUnfed: false }
  }

  function setCTOLegTermination(ceoId: number, splitterId: string, leg: number, termination: CTOTerminationType) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        const model = ensureCtoModel(c)
        const legConfigs = model.legConfigs ?? []

        const exists = legConfigs.some((x) => x.splitterId === splitterId && x.leg === leg)
        const nextLegConfigs = exists
          ? legConfigs.map((x) => (x.splitterId === splitterId && x.leg === leg ? { ...x, termination } : x))
          : [...legConfigs, { splitterId, leg, termination }]

        return {
          ...c,
          ctoModel: {
            ...model,
            legConfigs: nextLegConfigs
          }
        }
      })
    )
  }

  function setCTOExplicitlyUnfed(ceoId: number, explicitlyUnfed: boolean) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        const model = ensureCtoModel(c)
        return {
          ...c,
          ctoModel: {
            ...model,
            explicitlyUnfed
          }
        }
      })
    )
  }

  function setCTOSplitterConfig(ceoId: number, splitterId: string, patch: Partial<{
    connectorized: boolean
    connectorType: CTOConnectorType
    docName: string
    docCode: string
    docModel: string
    docNotes: string
  }>) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        const model = ensureCtoModel(c)
        const list = model.splitterConfigs ?? []
        const exists = list.some((x) => x.splitterId === splitterId)
        const next = exists
          ? list.map((x) => (x.splitterId === splitterId ? { ...x, ...patch } : x))
          : [...list, { splitterId, connectorized: patch.connectorized ?? true, connectorType: patch.connectorType ?? "APC" }]
        return {
          ...c,
          ctoModel: {
            ...model,
            splitterConfigs: next
          }
        }
      })
    )
  }

  function setCTOCableTubeSize(ceoId: number, cableId: number, tubeSize: CTOCableTubeSize) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c

        const model = ensureCtoModel(c)
        const exists = model.cableTubes.some((t) => t.cableId === cableId)
        const cableTubes = exists
          ? model.cableTubes.map((t) => (t.cableId === cableId ? { ...t, tubeSize } : t))
          : [...model.cableTubes, { cableId, tubeSize }]

        return { ...c, ctoModel: { ...model, cableTubes } }
      })
    )
  }

  function addOLTSlot(ceoId: number) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId || c.tipo !== "OLT") return c
        const slots = c.oltModel?.slots ?? []
        const idx = slots.length + 1
        return {
          ...c,
          oltModel: {
            slots: [...slots, { id: `SLOT-${nextId()}`, label: `Slot ${idx}`, pons: [] }]
          }
        }
      })
    )
  }

  function addOLTPon(ceoId: number, slotId: string) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId || c.tipo !== "OLT") return c

        const outN = nextOutIndex(c.ports)
        const portId = `OUT-${outN}`

        const slots = (c.oltModel?.slots ?? []).map((slot) => {
          if (slot.id !== slotId) return slot
          const pons = slot.pons ?? []
          const pIdx = pons.length + 1
          return {
            ...slot,
            pons: [
              ...pons,
              {
                id: `PON-${nextId()}`,
                label: `PON ${pIdx}`,
                portId,
                gbicClass: "B+" as OLTGbicClass,
                signalProfile: "GPON" as OLTSignalProfile,
                enabled: true
              }
            ]
          }
        })

        return {
          ...c,
          ports: [...c.ports, { id: portId, label: `PON ${outN}`, direction: "OUT", caboId: null }],
          oltModel: { slots }
        }
      })
    )
  }

  function setOLTPonConfig(
    ceoId: number,
    slotId: string,
    ponId: string,
    patch: Partial<{ gbicClass: OLTGbicClass; signalProfile: OLTSignalProfile; txDbm: number; enabled: boolean }>
  ) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId || c.tipo !== "OLT") return c
        const slots = (c.oltModel?.slots ?? []).map((slot) => {
          if (slot.id !== slotId) return slot
          return {
            ...slot,
            pons: (slot.pons ?? []).map((pon) => (pon.id === ponId ? { ...pon, ...patch } : pon))
          }
        })
        return { ...c, oltModel: { slots } }
      })
    )
  }

  function activateSignalFromPort(nodeId: number, portId: string, fibraId: number, label: string) {
    setActiveSignalSource({ nodeId, portId, fibraId, label })
  }

  function clearActiveSignal() {
    setActiveSignalSource(null)
  }

  function addCTODrop(
    ceoId: number,
    splitterId: string,
    leg: number,
    target: SplitterRef | null,
    clientName: string
  ) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        const model = ensureCtoModel(c)

        const already = model.drops.some((d) => d.splitterId === splitterId && d.leg === leg)
        if (already) return c

        return {
          ...c,
          ctoModel: {
            ...model,
            drops: [
              ...model.drops,
              {
                id: `DROP-${nextId()}`,
                splitterId,
                leg,
                target,
                clientName: clientName.trim() || `Cliente OUT ${leg}`,
                status: "PLANEJADO" as CTODropStatus
              }
            ]
          }
        }
      })
    )
  }

  function updateCTODrop(ceoId: number, dropId: string, patch: Partial<{
    clientName: string
    clientCode: string
    notes: string
    status: CTODropStatus
    target: SplitterRef | null
  }>) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        const model = ensureCtoModel(c)

        return {
          ...c,
          ctoModel: {
            ...model,
            drops: model.drops.map((d) => (d.id === dropId ? { ...d, ...patch } : d))
          }
        }
      })
    )
  }

  function removeCTODrop(ceoId: number, dropId: string) {
    setCeos((prev) =>
      prev.map((c0) => {
        const c = normalizeCEO(c0)
        if (c.id !== ceoId) return c
        if (c.tipo !== "CTO") return c
        const model = ensureCtoModel(c)
        return { ...c, ctoModel: { ...model, drops: model.drops.filter((d) => d.id !== dropId) } }
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
    addCTOPrimarySplitter,
    addCTOSecondarySplitter,
    removeSplitter,
    setSplitterInputRef,
    setSplitterOutputRef,
    setSplitterLegUnbalanced,
    setCTOCableTubeSize,
    setCTOLegTermination,
    setCTOSplitterConfig,
    setCTOExplicitlyUnfed,
    addCTODrop,
    updateCTODrop,
    removeCTODrop,
    addOLTSlot,
    addOLTPon,
    setOLTPonConfig,
    activeSignalSource,
    activateSignalFromPort,
    clearActiveSignal,

    mode,
    setMode
  }
}
