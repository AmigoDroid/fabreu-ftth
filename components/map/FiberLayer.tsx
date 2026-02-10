"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Polyline, InfoWindow } from "@react-google-maps/api"
import { CEO, FiberSegment } from "@/types/ftth"
import { calcularComprimento, getFiberCenter } from "./mapUtils"

type State = { cableId: number; coreId: number }
type ActiveSignalSource = { nodeId: number; portId: string; fibraId: number; label: string } | null

function buildAdjacency(fibers: FiberSegment[], ceos: CEO[]) {
  const fiberById = new Map<number, FiberSegment>()
  for (const f of fibers) fiberById.set(f.id, f)

  function caboIdByPort(node: CEO, portId: string): number | null {
    const p = node.ports.find((x) => x.id === portId)
    return p?.caboId ?? null
  }

  const adj = new Map<string, State[]>()
  const addEdge = (a: State, b: State) => {
    const ka = `${a.cableId}|${a.coreId}`
    const kb = `${b.cableId}|${b.coreId}`
    if (!adj.has(ka)) adj.set(ka, [])
    if (!adj.has(kb)) adj.set(kb, [])
    adj.get(ka)!.push(b)
    adj.get(kb)!.push(a)
  }

  for (const node of ceos) {
    for (const f of node.fusoes ?? []) {
      const aCabo = caboIdByPort(node, f.a.portId)
      const bCabo = caboIdByPort(node, f.b.portId)
      if (aCabo == null || bCabo == null) continue
      if (!fiberById.has(aCabo) || !fiberById.has(bCabo)) continue
      addEdge({ cableId: aCabo, coreId: f.a.fibraId }, { cableId: bCabo, coreId: f.b.fibraId })
    }
  }

  for (const node of ceos) {
    const primary = node.splitters.find((s) => s.role === "PRIMARY") ?? null
    for (const s of node.splitters ?? []) {
      let sourceRef = s.input
      if (!sourceRef && node.tipo === "CTO" && s.role === "SECONDARY" && primary?.input && s.parentLeg != null) {
        sourceRef = primary.input
      }
      if (!sourceRef) continue
      const inCabo = caboIdByPort(node, sourceRef.portId)
      if (inCabo == null || !fiberById.has(inCabo)) continue
      for (const o of s.outputs ?? []) {
        if (!o.target) continue
        const outCabo = caboIdByPort(node, o.target.portId)
        if (outCabo == null || !fiberById.has(outCabo)) continue
        addEdge({ cableId: inCabo, coreId: sourceRef.fibraId }, { cableId: outCabo, coreId: o.target.fibraId })
      }
    }
  }

  return { fiberById, adj }
}

function traceFromState(start: State, fibers: FiberSegment[], ceos: CEO[]) {
  const { fiberById, adj } = buildAdjacency(fibers, ceos)
  const visited = new Set<string>()
  const q: State[] = [start]
  const cableToCoreIds = new Map<number, Set<number>>()

  while (q.length) {
    const cur = q.shift()!
    const k = `${cur.cableId}|${cur.coreId}`
    if (visited.has(k)) continue
    visited.add(k)
    if (!fiberById.has(cur.cableId)) continue
    if (!cableToCoreIds.has(cur.cableId)) cableToCoreIds.set(cur.cableId, new Set<number>())
    cableToCoreIds.get(cur.cableId)!.add(cur.coreId)

    for (const nx of adj.get(k) ?? []) {
      const nk = `${nx.cableId}|${nx.coreId}`
      if (!visited.has(nk)) q.push(nx)
    }
  }

  return cableToCoreIds
}

type Props = {
  fibers: FiberSegment[]
  ceos: CEO[]
  selectedFiber: FiberSegment | null
  setSelectedFiber: (f: FiberSegment | null) => void
  polylineRefs: React.MutableRefObject<Record<number, google.maps.Polyline>>
  onSaveEdit: () => void
  mode: "draw-fiber" | "place-pop" | "place-ceo" | "place-cto" | "place-olt" | "place-dio" | "place-cliente" | null
  activeSignalSource: ActiveSignalSource
  onRequestPlaceBox: (click: { lat: number; lng: number }, sourceFiberId: number) => void
}

export function FiberLayer({
  fibers,
  ceos,
  selectedFiber,
  setSelectedFiber,
  polylineRefs,
  onSaveEdit,
  mode,
  activeSignalSource,
  onRequestPlaceBox
}: Props) {
  const [coreId, setCoreId] = useState<number>(1)
  const [infoPosition, setInfoPosition] = useState<google.maps.LatLngLiteral | null>(null)
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t = window.setInterval(() => setPhase((v) => (v + 3) % 100), 80)
    return () => window.clearInterval(t)
  }, [])

  const signalStart = useMemo(() => {
    if (!activeSignalSource) return null
    const node = ceos.find((c) => c.id === activeSignalSource.nodeId)
    const cableId = node?.ports.find((p) => p.id === activeSignalSource.portId)?.caboId ?? null
    if (cableId == null) return null
    return { cableId, coreId: activeSignalSource.fibraId }
  }, [activeSignalSource, ceos])

  const selectedStart = useMemo(() => {
    if (!selectedFiber) return null
    return { cableId: selectedFiber.id, coreId }
  }, [selectedFiber, coreId])

  const traceStart = signalStart ?? selectedStart

  const cableToCoreIds = useMemo(() => {
    if (!traceStart) return new Map<number, Set<number>>()
    return traceFromState(traceStart, fibers, ceos)
  }, [traceStart, fibers, ceos])

  const traceSegmentIds = useMemo(() => new Set<number>([...cableToCoreIds.keys()]), [cableToCoreIds])

  const selectedCoreColor = useMemo(() => {
    if (!traceStart) return null
    const cable = fibers.find((f) => f.id === traceStart.cableId)
    return cable?.fibras.find((x) => x.id === traceStart.coreId)?.cor ?? "#00ff00"
  }, [traceStart, fibers])

  return (
    <>
      {fibers.map((f) => {
        const isSelected = selectedFiber?.id === f.id
        const hasActiveTrace = traceSegmentIds.has(f.id)
        return (
          <Polyline
            key={`base-${f.id}`}
            path={f.path}
            options={{
              strokeColor: hasActiveTrace ? "#202938" : isSelected ? "#00ff00" : (f.caboCor ?? "#ff5500"),
              strokeWeight: hasActiveTrace ? 5 : isSelected ? 8 : 5,
              strokeOpacity: hasActiveTrace ? 0.85 : 1,
              editable: isSelected
            }}
            onLoad={(poly) => {
              const prev = polylineRefs.current[f.id]
              if (prev && prev !== poly) prev.setMap(null)
              polylineRefs.current[f.id] = poly
            }}
            onUnmount={() => {
              const cur = polylineRefs.current[f.id]
              if (cur) {
                cur.setMap(null)
                delete polylineRefs.current[f.id]
              }
            }}
            onClick={(e) => {
              const lat = e.latLng?.lat()
              const lng = e.latLng?.lng()
              if (lat == null || lng == null) return

              if (mode && mode !== "draw-fiber" && mode !== "place-pop") {
                onRequestPlaceBox({ lat, lng }, f.id)
                return
              }

              setInfoPosition({ lat, lng })
              setSelectedFiber(f)
            }}
          />
        )
      })}

      {[...cableToCoreIds.entries()].flatMap(([cableId, coreSet]) => {
        const cable = fibers.find((f) => f.id === cableId)
        if (!cable) return []
        return [...coreSet].map((fiberId) => {
          const color = cable.fibras.find((x) => x.id === fiberId)?.cor ?? selectedCoreColor ?? "#22d3ee"
          return (
            <Polyline
              key={`flow-${cableId}-${fiberId}`}
              path={cable.path}
              options={{
                strokeColor: color,
                strokeOpacity: 0.92,
                strokeWeight: 8,
                clickable: false,
                icons: [
                  {
                    icon: {
                      path: "M 0,-1 0,1",
                      strokeOpacity: 1,
                      strokeColor: "#ffffff",
                      scale: 4
                    },
                    offset: `${phase}%`,
                    repeat: "24px"
                  }
                ]
              }}
            />
          )
        })
      })}

      {selectedFiber &&
        (() => {
          const center = getFiberCenter(selectedFiber.path) as google.maps.LatLngLiteral | null
          const popupPos = infoPosition ?? center
          if (!popupPos) return null

          const coreSegments = fibers.filter((f) => traceSegmentIds.has(f.id))
          const fallbackSegments = coreSegments.length ? coreSegments : [selectedFiber]
          const coreM = fallbackSegments.reduce((acc, f) => acc + calcularComprimento(f.path), 0)
          const coreKm = coreM / 1000
          const perdaFibra = coreKm * 0.25

          return (
            <InfoWindow
              position={popupPos}
              onCloseClick={() => {
                setInfoPosition(null)
                setSelectedFiber(null)
              }}
            >
              <div style={{ minWidth: 320, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 800 }}>Cabo: {selectedFiber.nome}</div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#555" }}>Core:</span>
                  <select value={coreId} onChange={(e) => setCoreId(Number(e.target.value))} style={{ padding: "4px 8px", borderRadius: 8 }}>
                    {Array.from({ length: selectedFiber.fibras?.length ?? 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Fibra {n}</option>)}
                  </select>
                  <span style={{ width: 14, height: 14, borderRadius: 999, background: selectedCoreColor ?? "#00ff00", border: "1px solid #333", display: "inline-block" }} />
                </div>

                {activeSignalSource && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#14532d", fontWeight: 700 }}>
                    Sinal ativo: {activeSignalSource.label} / F{activeSignalSource.fibraId}
                  </div>
                )}

                <div style={{ marginTop: 8 }}>Caminho do core: {coreKm.toFixed(2)} km</div>
                <div style={{ marginTop: 6 }}>Perda estimada: {perdaFibra.toFixed(2)} dB</div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                  Trechos com sinal: {traceSegmentIds.size}
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button onClick={onSaveEdit} style={{ border: "1px solid #ddd", background: "#111", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700 }}>
                    Salvar cabo
                  </button>
                  <button onClick={() => { setInfoPosition(null); setSelectedFiber(null) }} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 700 }}>
                    Fechar
                  </button>
                </div>
              </div>
            </InfoWindow>
          )
        })()}
    </>
  )
}
