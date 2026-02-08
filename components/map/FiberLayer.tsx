"use client"

import React, { useMemo, useState } from "react"
import { Polyline, InfoWindow } from "@react-google-maps/api"
import { CEO, FiberSegment } from "@/types/ftth"
import { calcularComprimento, getFiberCenter } from "./mapUtils"

type End = { ceoId: number; portId: string }
type State = { fiberId: number; coreId: number; atPortId?: string | null }

function buildIndexes(fibers: FiberSegment[], ceos: CEO[]) {
  const fiberById = new Map<number, FiberSegment>()
  fibers.forEach((f) => fiberById.set(f.id, f))

  // caboId -> endpoints (ceoId, portId)
  const endpointsByCable = new Map<number, End[]>()

  for (const c of ceos) {
    for (const p of c.ports ?? []) {
      if (p.caboId == null) continue
      if (!endpointsByCable.has(p.caboId)) endpointsByCable.set(p.caboId, [])
      endpointsByCable.get(p.caboId)!.push({ ceoId: c.id, portId: p.id })
    }
  }

  const ceoById = new Map<number, CEO>()
  ceos.forEach((c) => ceoById.set(c.id, c))

  return { fiberById, endpointsByCable, ceoById }
}

/**
 * Rede física: todos os cabos conectados por CEOs (qualquer porta).
 */
function getConnectedNetwork(startFiberId: number, fibers: FiberSegment[], ceos: CEO[]) {
  const { fiberById, endpointsByCable, ceoById } = buildIndexes(fibers, ceos)

  const visitedFibers = new Set<number>()
  const visitedCEOs = new Set<number>()
  const q: number[] = [startFiberId]

  while (q.length) {
    const fid = q.shift()!
    if (visitedFibers.has(fid)) continue
    if (!fiberById.has(fid)) continue

    visitedFibers.add(fid)

    const eps = endpointsByCable.get(fid) ?? []
    for (const ep of eps) {
      visitedCEOs.add(ep.ceoId)
      const ceo = ceoById.get(ep.ceoId)
      if (!ceo) continue

      // a CEO conecta todos os cabos plugados em suas portas
      for (const p of ceo.ports ?? []) {
        if (p.caboId == null) continue
        if (!visitedFibers.has(p.caboId) && fiberById.has(p.caboId)) q.push(p.caboId)
      }
    }
  }

  return {
    networkFibers: fibers.filter((f) => visitedFibers.has(f.id)),
    networkCEOs: ceos.filter((c) => visitedCEOs.has(c.id))
  }
}

/**
 * Rede REAL do core:
 * Estado BFS = (caboAtual, coreAtual, portaAtual)
 * Ao atravessar uma CEO, só atravessa se existir fusão ligando (portaAtual, coreAtual) a outra ponta.
 */
function traceCoreNetwork(startFiberId: number, startCoreId: number, fibers: FiberSegment[], ceos: CEO[]) {
  const { fiberById, endpointsByCable, ceoById } = buildIndexes(fibers, ceos)

  const visitedState = new Set<string>() // "fiberId|coreId|portId"
  const visitedSegments = new Set<number>()
  const visitedCEOs = new Set<number>()

  const q: State[] = [{ fiberId: startFiberId, coreId: startCoreId, atPortId: null }]

  const pushState = (s: State) => {
    const key = `${s.fiberId}|${s.coreId}|${s.atPortId ?? ""}`
    if (visitedState.has(key)) return
    q.push(s)
  }

  while (q.length) {
    const cur = q.shift()!
    const key = `${cur.fiberId}|${cur.coreId}|${cur.atPortId ?? ""}`
    if (visitedState.has(key)) continue
    visitedState.add(key)

    if (!fiberById.has(cur.fiberId)) continue
    visitedSegments.add(cur.fiberId)

    // todas as CEOs onde esse cabo está plugado (pode ser em IN-1 ou OUT-n)
    const endpoints = endpointsByCable.get(cur.fiberId) ?? []
    for (const ep of endpoints) {
      const ceo = ceoById.get(ep.ceoId)
      if (!ceo) continue

      // Estamos "entrando" na CEO pela porta ep.portId
      const inPortId = ep.portId

      // procura fusão que contenha exatamente (inPortId, coreId)
      const fusoes = ceo.fusoes ?? []
      for (const f of fusoes) {
        let outPortId: string | null = null
        let outCoreId: number | null = null

        if (f.a.portId === inPortId && f.a.fibraId === cur.coreId) {
          outPortId = f.b.portId
          outCoreId = f.b.fibraId
        } else if (f.b.portId === inPortId && f.b.fibraId === cur.coreId) {
          outPortId = f.a.portId
          outCoreId = f.a.fibraId
        }

        if (!outPortId || outCoreId == null) continue

        const outPort = (ceo.ports ?? []).find((p) => p.id === outPortId) ?? null
        const nextFiberId = outPort?.caboId ?? null
        if (nextFiberId == null) continue
        if (!fiberById.has(nextFiberId)) continue

        visitedCEOs.add(ceo.id)
        pushState({ fiberId: nextFiberId, coreId: outCoreId, atPortId: outPortId })
      }
    }
  }

  const segments = fibers.filter((f) => visitedSegments.has(f.id))
  const ceosUsed = ceos.filter((c) => visitedCEOs.has(c.id))
  return { segments, ceosUsed }
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

  const netAll = useMemo(() => {
    if (!selectedFiber) return null
    return getConnectedNetwork(selectedFiber.id, fibers, ceos)
  }, [selectedFiber?.id, fibers, ceos])

  const netCore = useMemo(() => {
    if (!selectedFiber) return null
    return traceCoreNetwork(selectedFiber.id, coreId, fibers, ceos)
  }, [selectedFiber?.id, coreId, fibers, ceos])

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

  const totalCores = selectedFiber?.fibras?.length ?? 12

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
              strokeColor: isInCorePath
                ? selectedCoreColor!
                : isSelected
                  ? "#00ff00"
                  : (f.caboCor ?? "#ff5500"),
              strokeWeight: isInCorePath ? 7 : isSelected ? 8 : 5,
              editable: isSelected,
              zIndex: isInCorePath ? 3 : isSelected ? 2 : 1
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

          // CABO inteiro (rede física)
          const allSegments = netAll?.networkFibers ?? [selectedFiber]
          const allCEOs = netAll?.networkCEOs ?? []
          const allM = allSegments.reduce((acc, f) => acc + calcularComprimento(f.path), 0)
          const allKm = allM / 1000

          // Core selecionado (rede lógica)
          const coreSegments = netCore?.segments ?? [selectedFiber]
          const coreCEOs = netCore?.ceosUsed ?? []
          const coreM = coreSegments.reduce((acc, f) => acc + calcularComprimento(f.path), 0)
          const coreKm = coreM / 1000

          // ✅ emendas: 1 por CEO atravessada pelo core (não depende do total de fibras)
          const emendasFibra = coreCEOs.length

          // parâmetros
          const atenuacaoPorKm = 0.25
          const perdaPorEmenda = 0.1
          const conectores = 0
          const perdaPorConector = 0.2
          const splitters: number[] = [] // depois você soma aqui a perda dos splitters usados no caminho

          const perdaFibra = coreKm * atenuacaoPorKm
          const perdaEmendas = emendasFibra * perdaPorEmenda
          const perdaConectores = conectores * perdaPorConector
          const perdaSplitters = splitters.reduce((a, v) => a + v, 0)
          const perdaTotal = perdaFibra + perdaEmendas + perdaConectores + perdaSplitters

          return (
            <InfoWindow position={center} onCloseClick={() => setSelectedFiber(null)}>
              <div style={{ minWidth: 320, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 800 }}>Fibra: {selectedFiber.nome}</div>

                <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                  Cabo inteiro: 📏 {allKm.toFixed(2)} km • CEOs: {allCEOs.length} • Trechos: {allSegments.length}
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#555" }}>Core:</span>
                  <select
                    value={coreId}
                    onChange={(e) => setCoreId(Number(e.target.value))}
                    style={{ padding: "4px 8px", borderRadius: 8 }}
                  >
                    {Array.from({ length: totalCores }, (_, i) => i + 1).map((n) => (
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

                <div style={{ marginTop: 8 }}>
                  📏 Fibra {coreId}: {coreKm.toFixed(2)} km
                </div>
                <div style={{ marginTop: 6 }}>
                  📉 Perda estimada (Fibra {coreId}): {perdaTotal.toFixed(2)} dB
                </div>

                <div style={{ marginTop: 10 }}>
                  <div>Fibra: {perdaFibra.toFixed(2)} dB</div>
                  <div>{emendasFibra} Emendas: {perdaEmendas.toFixed(2)} dB</div>
                  <div>{conectores} Conectores: {perdaConectores.toFixed(2)} dB</div>
                  <div>{splitters.length} Splitter: {perdaSplitters.toFixed(2)} dB</div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                  Caminho do core: trechos {coreSegments.length} • CEOs atravessadas {coreCEOs.length}
                </div>
              </div>
            </InfoWindow>
          )
        })()}
    </>
  )
}