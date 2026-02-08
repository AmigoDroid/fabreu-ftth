"use client"

import React, { useMemo, useState } from "react"
import { Polyline, InfoWindow } from "@react-google-maps/api"
import { CEO, FiberSegment } from "@/types/ftth"
import { calcularComprimento, getFiberCenter } from "./mapUtils"

type State = { cableId: number; coreId: number }

function traceCoreNetwork(startCableId: number, startCoreId: number, fibers: FiberSegment[], ceos: CEO[]) {
  const fiberById = new Map<number, FiberSegment>()
  for (const f of fibers) fiberById.set(f.id, f)

  // helper: resolve caboId a partir do portId dentro da CEO
  function caboIdByPort(ceo: CEO, portId: string): number | null {
    const p = ceo.ports.find((x) => x.id === portId)
    return p?.caboId ?? null
  }

  // grafo: "cableId|coreId" -> lista de próximos estados
  const adj = new Map<string, State[]>()

  function addEdge(a: State, b: State) {
    const ka = `${a.cableId}|${a.coreId}`
    const kb = `${b.cableId}|${b.coreId}`
    if (!adj.has(ka)) adj.set(ka, [])
    if (!adj.has(kb)) adj.set(kb, [])
    adj.get(ka)!.push(b)
    adj.get(kb)!.push(a)
  }

  // 1) Fusões: conecta fibra(porta A) <-> fibra(porta B)
  for (const ceo of ceos) {
    for (const f of ceo.fusoes ?? []) {
      const aCabo = caboIdByPort(ceo, f.a.portId)
      const bCabo = caboIdByPort(ceo, f.b.portId)
      if (aCabo == null || bCabo == null) continue
      if (!fiberById.has(aCabo) || !fiberById.has(bCabo)) continue

      addEdge({ cableId: aCabo, coreId: f.a.fibraId }, { cableId: bCabo, coreId: f.b.fibraId })
    }
  }

  // 2) Splitters: conecta input <-> cada output.target
  for (const ceo of ceos) {
    for (const s of ceo.splitters ?? []) {
      if (!s.input) continue
      const inCabo = caboIdByPort(ceo, s.input.portId)
      if (inCabo == null || !fiberById.has(inCabo)) continue

      for (const o of s.outputs ?? []) {
        if (!o.target) continue
        const outCabo = caboIdByPort(ceo, o.target.portId)
        if (outCabo == null || !fiberById.has(outCabo)) continue

        // liga inputFibra -> alvoFibra
        addEdge({ cableId: inCabo, coreId: s.input.fibraId }, { cableId: outCabo, coreId: o.target.fibraId })
      }
    }
  }

  // BFS
  const visited = new Set<string>()
  const visitedCables = new Set<number>()
  const q: State[] = [{ cableId: startCableId, coreId: startCoreId }]

  while (q.length) {
    const cur = q.shift()!
    const k = `${cur.cableId}|${cur.coreId}`
    if (visited.has(k)) continue
    visited.add(k)

    if (!fiberById.has(cur.cableId)) continue
    visitedCables.add(cur.cableId)

    const nexts = adj.get(k) ?? []
    for (const nx of nexts) {
      const nk = `${nx.cableId}|${nx.coreId}`
      if (!visited.has(nk)) q.push(nx)
    }
  }

  const segments = fibers.filter((f) => visitedCables.has(f.id))
  return { segments }
}

type Props = {
  fibers: FiberSegment[]
  ceos: CEO[]
  selectedFiber: FiberSegment | null
  setSelectedFiber: (f: FiberSegment | null) => void
  polylineRefs: React.MutableRefObject<Record<number, google.maps.Polyline>>
}

export function FiberLayer({ fibers, ceos, selectedFiber, setSelectedFiber, polylineRefs }: Props) {
  const [coreId, setCoreId] = useState<number>(1)

  const netCore = useMemo(() => {
    if (!selectedFiber) return null
    return traceCoreNetwork(selectedFiber.id, coreId, fibers, ceos)
  }, [selectedFiber, coreId, fibers, ceos])

  const coreSegmentIds = useMemo(() => {
    const ids = new Set<number>()
    for (const s of netCore?.segments ?? []) ids.add(s.id)
    return ids
  }, [netCore?.segments])

  const selectedCoreColor = useMemo(() => {
    if (!selectedFiber) return null
    const cor = selectedFiber.fibras?.find((f) => f.id === coreId)?.cor
    return cor ?? "#00ff00"
  }, [selectedFiber, coreId])

  return (
    <>
      {fibers.map((f) => {
        const isSelected = selectedFiber?.id === f.id
        const isInCorePath = !!selectedFiber && !!selectedCoreColor && coreSegmentIds.has(f.id)

        return (
          <Polyline
            key={f.id}
            path={f.path}
            options={{
              strokeColor: isInCorePath ? selectedCoreColor! : isSelected ? "#00ff00" : (f.caboCor ?? "#ff5500"),
              strokeWeight: isInCorePath ? 7 : isSelected ? 8 : 5,
              editable: isSelected
            }}
            onLoad={(poly) => {
              polylineRefs.current[f.id] = poly
            }}
            onClick={() => setSelectedFiber(f)}
          />
        )
      })}

      {selectedFiber &&
        (() => {
          const center = getFiberCenter(selectedFiber.path) as google.maps.LatLngLiteral | null
          if (!center) return null

          const coreSegments = netCore?.segments ?? [selectedFiber]
          const coreM = coreSegments.reduce((acc, f) => acc + calcularComprimento(f.path), 0)
          const coreKm = coreM / 1000

          // parâmetros
          const atenuacaoPorKm = 0.25
          const perdaFibra = coreKm * atenuacaoPorKm

          return (
            <InfoWindow position={center} onCloseClick={() => setSelectedFiber(null)}>
              <div style={{ minWidth: 300, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 800 }}>Cabo: {selectedFiber.nome}</div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#555" }}>Core:</span>
                  <select
                    value={coreId}
                    onChange={(e) => setCoreId(Number(e.target.value))}
                    style={{ padding: "4px 8px", borderRadius: 8 }}
                  >
                    {Array.from({ length: selectedFiber.fibras?.length ?? 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Fibra {n}
                      </option>
                    ))}
                  </select>

                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: selectedCoreColor ?? "#00ff00",
                      border: "1px solid #333",
                      display: "inline-block"
                    }}
                    title="Cor do core"
                  />
                </div>

                <div style={{ marginTop: 8 }}>📏 Caminho do core: {coreKm.toFixed(2)} km</div>
                <div style={{ marginTop: 6 }}>📉 Perda estimada: {perdaFibra.toFixed(2)} dB</div>

                <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                  Trechos atravessados (inclui splitters se conectados): {coreSegments.length}
                </div>
              </div>
            </InfoWindow>
          )
        })()}
    </>
  )
}