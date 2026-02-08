"use client"

import React, { useMemo, useState } from "react"
import { Polyline, InfoWindow } from "@react-google-maps/api"
import { CEO, FiberSegment } from "@/types/ftth"
import { calcularComprimento, getFiberCenter } from "./mapUtils"

function getConnectedNetwork(startFiberId: number, fibers: FiberSegment[], ceos: CEO[]) {
  const fiberById = new Map<number, FiberSegment>()
  fibers.forEach((f) => fiberById.set(f.id, f))

  const ceosByFiber = new Map<number, CEO[]>()
  for (const c of ceos) {
    if (!ceosByFiber.has(c.caboAId)) ceosByFiber.set(c.caboAId, [])
    if (!ceosByFiber.has(c.caboBId)) ceosByFiber.set(c.caboBId, [])
    ceosByFiber.get(c.caboAId)!.push(c)
    ceosByFiber.get(c.caboBId)!.push(c)
  }

  const visitedFibers = new Set<number>()
  const visitedCEOs = new Set<number>()
  const q: number[] = [startFiberId]

  while (q.length) {
    const fid = q.shift()!
    if (visitedFibers.has(fid)) continue
    visitedFibers.add(fid)

    for (const ceo of ceosByFiber.get(fid) ?? []) {
      visitedCEOs.add(ceo.id)
      const other = ceo.caboAId === fid ? ceo.caboBId : ceo.caboAId
      if (!visitedFibers.has(other) && fiberById.has(other)) q.push(other)
    }
  }

  return {
    networkFibers: fibers.filter((f) => visitedFibers.has(f.id)),
    networkCEOs: ceos.filter((c) => visitedCEOs.has(c.id))
  }
}

/**
 * ✅ Caminho REAL da fibra (core) baseado nas fusões.
 * Estado do BFS = (segmentoId, coreIdAtual)
 * Ao atravessar uma CEO, o core pode "trocar" conforme fusão cadastrada.
 */
function traceCoreNetwork(
  startFiberId: number,
  startCoreId: number,
  fibers: FiberSegment[],
  ceos: CEO[]
) {
  const fiberById = new Map<number, FiberSegment>()
  fibers.forEach((f) => fiberById.set(f.id, f))

  const ceosByFiber = new Map<number, CEO[]>()
  for (const c of ceos) {
    if (!ceosByFiber.has(c.caboAId)) ceosByFiber.set(c.caboAId, [])
    if (!ceosByFiber.has(c.caboBId)) ceosByFiber.set(c.caboBId, [])
    ceosByFiber.get(c.caboAId)!.push(c)
    ceosByFiber.get(c.caboBId)!.push(c)
  }

  const visitedState = new Set<string>() // "fiberId|coreId"
  const visitedSegments = new Set<number>()
  const visitedCEOs = new Set<number>()

  const q: Array<{ fiberId: number; coreId: number }> = [
    { fiberId: startFiberId, coreId: startCoreId }
  ]

  while (q.length) {
    const cur = q.shift()!
    const key = `${cur.fiberId}|${cur.coreId}`
    if (visitedState.has(key)) continue
    visitedState.add(key)

    if (!fiberById.has(cur.fiberId)) continue
    visitedSegments.add(cur.fiberId)

    for (const ceo of ceosByFiber.get(cur.fiberId) ?? []) {
      let nextFiberId: number | null = null
      let nextCoreId: number | null = null

      if (ceo.caboAId === cur.fiberId) {
        const fusao = (ceo.fusoes ?? []).find((f) => f.aFibraId === cur.coreId)
        if (fusao) {
          nextFiberId = ceo.caboBId
          nextCoreId = fusao.bFibraId
        }
      } else {
        const fusao = (ceo.fusoes ?? []).find((f) => f.bFibraId === cur.coreId)
        if (fusao) {
          nextFiberId = ceo.caboAId
          nextCoreId = fusao.aFibraId
        }
      }

      if (nextFiberId != null && nextCoreId != null && fiberById.has(nextFiberId)) {
        visitedCEOs.add(ceo.id)
        q.push({ fiberId: nextFiberId, coreId: nextCoreId })
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

export function FiberLayer({
  fibers,
  ceos,
  selectedFiber,
  setSelectedFiber,
  polylineRefs
}: Props) {
  const [coreId, setCoreId] = useState<number>(1)

  const netAll = useMemo(() => {
    if (!selectedFiber) return null
    return getConnectedNetwork(selectedFiber.id, fibers, ceos)
  }, [selectedFiber?.id, fibers, ceos])

  const netCore = useMemo(() => {
    if (!selectedFiber) return null
    return traceCoreNetwork(selectedFiber.id, coreId, fibers, ceos)
  }, [selectedFiber?.id, coreId, fibers, ceos])

  // ✅ IDs dos trechos que a fibra selecionada percorre
  const coreSegmentIds = useMemo(() => {
    const ids = new Set<number>()
    for (const s of netCore?.segments ?? []) ids.add(s.id)
    return ids
  }, [netCore?.segments])

  // ✅ cor da fibra selecionada (pegando do cabo clicado)
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
              strokeColor: isInCorePath
                ? selectedCoreColor!
                : isSelected
                  ? "#00ff00"
                  : (f.caboCor ?? "#ff5500"),
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

          // CABO inteiro (apenas informativo)
          const allSegments = netAll?.networkFibers ?? [selectedFiber]
          const allCEOs = netAll?.networkCEOs ?? []
          const allM = allSegments.reduce((acc, f) => acc + calcularComprimento(f.path), 0)
          const allKm = allM / 1000

          // Fibra selecionada (real)
          const coreSegments = netCore?.segments ?? [selectedFiber]
          const coreCEOs = netCore?.ceosUsed ?? []
          const coreM = coreSegments.reduce((acc, f) => acc + calcularComprimento(f.path), 0)
          const coreKm = coreM / 1000
          const emendasFibra = coreCEOs.length

          // parâmetros
          const atenuacaoPorKm = 0.25
          const perdaPorEmenda = 0.1
          const conectores = 0
          const perdaPorConector = 0.2
          const splitters: number[] = []

          const perdaFibra = coreKm * atenuacaoPorKm
          const perdaEmendas = emendasFibra * perdaPorEmenda
          const perdaConectores = conectores * perdaPorConector
          const perdaSplitters = splitters.reduce((a, v) => a + v, 0)

          const perdaTotal = perdaFibra + perdaEmendas + perdaConectores + perdaSplitters

          return (
            <InfoWindow position={center} onCloseClick={() => setSelectedFiber(null)}>
              <div style={{ minWidth: 300, lineHeight: 1.35 }}>
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
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
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

                <div style={{ marginTop: 8 }}>📏 Fibra {coreId}: {coreKm.toFixed(2)} km</div>
                <div style={{ marginTop: 6 }}>📉 Perda estimada (Fibra {coreId}): {perdaTotal.toFixed(2)} dB</div>

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