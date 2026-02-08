// components/map/FusionLinesLayer.tsx
"use client"

import { Polyline } from "@react-google-maps/api"
import { CEO, FiberSegment } from "@/types/ftth"

type Props = {
  ceos: CEO[]
  fiberList: FiberSegment[]
  onlyCEOId?: number | null // opcional: desenhar só da CEO selecionada
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

// gera um “ponto” ao redor da CEO (distância em metros + ângulo)
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

export function FusionLinesLayer({ ceos, fiberList, onlyCEOId }: Props) {
  // precisa do geometry carregado (você já está carregando)
  if (!google?.maps?.geometry?.spherical) return null

  const list = onlyCEOId != null ? ceos.filter((c) => c.id === onlyCEOId) : ceos

  return (
    <>
      {list.flatMap((ceo) =>
        ceo.fusoes.map((f) => {
          // Distribui as fibras em "leque" dos dois lados:
          // A fica à esquerda (180°), B à direita (0°)
          const spread = 70 // abertura do leque (graus)
          const aAngle = 180 + (f.aFibraId - 6.5) * (spread / 12)
          const bAngle = 0 + (f.bFibraId - 6.5) * (spread / 12)

          const pA = offsetPoint(ceo.position, 4, aAngle) // 4m do centro
          const pB = offsetPoint(ceo.position, 4, bAngle)

          const cor = getFiberColor(fiberList, ceo.caboAId, f.aFibraId)

          return (
            <Polyline
              key={`${ceo.id}-${f.aFibraId}-${f.bFibraId}`}
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