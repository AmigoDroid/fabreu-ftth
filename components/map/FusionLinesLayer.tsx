"use client"

import { Polyline } from "@react-google-maps/api"
import { CEO, FiberSegment } from "@/types/ftth"

type Props = {
  ceos: CEO[]
  fiberList: FiberSegment[]
  onlyCEOId?: number | null
}

function getFiberColor(
  fiberList: FiberSegment[],
  caboId: number,
  fibraId: number
): string {
  const cabo = fiberList.find((c) => c.id === caboId)
  const fibra = cabo?.fibras?.find((f) => f.id === fibraId)
  return fibra?.cor ?? "#111111"
}

function offsetPoint(
  center: { lat: number; lng: number },
  meters: number,
  headingDegrees: number
) {
  const p = google.maps.geometry.spherical.computeOffset(
    new google.maps.LatLng(center.lat, center.lng),
    meters,
    headingDegrees
  )
  return { lat: p.lat(), lng: p.lng() }
}

/**
 * Define um ângulo “base” para cada porta:
 * - IN-1 fica na esquerda (180°)
 * - OUT-* fica do lado direito (0°) espalhado por porta
 */
function getPortBaseAngle(ceo: CEO, portId: string): number {
  if (portId === "IN-1") return 180

  // pega só OUTs ordenados
  const outs = (ceo.ports ?? [])
    .filter((p) => p.direction === "OUT")
    .sort((a, b) => {
      const na = Number(String(a.id).replace("OUT-", "")) || 0
      const nb = Number(String(b.id).replace("OUT-", "")) || 0
      return na - nb
    })

  const idx = outs.findIndex((p) => p.id === portId)
  if (idx < 0) return 0

  // espalha as portas OUT num arco pequeno do lado direito
  // ex: -45° .. +45° (em torno de 0°)
  const span = 90
  const n = Math.max(outs.length, 1)

  if (n === 1) return 0

  const step = span / (n - 1)
  return -span / 2 + idx * step
}

/**
 * Dentro de cada porta, espalha as fibras em um leque local.
 * Usa a quantidade de fibras do cabo (se existir), senão assume 12.
 */
function getCoreOffsetAngle(coreId: number, totalCores: number): number {
  const spread = 60 // abertura do leque por porta
  const mid = (totalCores + 1) / 2
  const step = spread / Math.max(totalCores, 1)
  return (coreId - mid) * step
}

export function FusionLinesLayer({ ceos, fiberList, onlyCEOId }: Props) {
  if (!google?.maps?.geometry?.spherical) return null

  const list = onlyCEOId != null ? ceos.filter((c) => c.id === onlyCEOId) : ceos

  return (
    <>
      {list.flatMap((ceo) =>
        (ceo.fusoes ?? []).map((f) => {
          const portA = ceo.ports.find((p) => p.id === f.a.portId) ?? null
          const portB = ceo.ports.find((p) => p.id === f.b.portId) ?? null

          const caboAId = portA?.caboId ?? null
          const caboBId = portB?.caboId ?? null
          if (caboAId == null || caboBId == null) return null

          const caboA = fiberList.find((c) => c.id === caboAId) ?? null
          const caboB = fiberList.find((c) => c.id === caboBId) ?? null

          const totalA = caboA?.fibras?.length ?? 12
          const totalB = caboB?.fibras?.length ?? 12

          // ângulo base por porta
          const baseA = getPortBaseAngle(ceo, f.a.portId)
          const baseB = getPortBaseAngle(ceo, f.b.portId)

          // leque por fibra dentro daquela porta
          const aAngle = baseA + getCoreOffsetAngle(f.a.fibraId, totalA)
          const bAngle = baseB + getCoreOffsetAngle(f.b.fibraId, totalB)

          const pA = offsetPoint(ceo.position, 4, aAngle)
          const pB = offsetPoint(ceo.position, 4, bAngle)

          const cor = getFiberColor(fiberList, caboAId, f.a.fibraId)

          return (
            <Polyline
              key={`${ceo.id}-${f.a.portId}-${f.a.fibraId}-${f.b.portId}-${f.b.fibraId}`}
              path={[pA, pB]}
              options={{
                strokeColor: cor,
                strokeWeight: 3,
                clickable: false,
                zIndex: 9999
              }}
            />
          )
        })
      )}
    </>
  )
}