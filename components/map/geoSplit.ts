// components/map/geoSplit.ts
import { LatLng } from "@/types/ftth"

function toG(p: LatLng) {
  return new google.maps.LatLng(p.lat, p.lng)
}

/**
 * Acha o ponto mais próximo do clique em cima do path (amostragem por segmento).
 * Retorna a distância em metros, o ponto "snapado" e o índice do segmento.
 */
export function findClosestPointOnPath(
  path: LatLng[],
  click: LatLng,
  samplesPerSegment = 25
) {
  const clickG = toG(click)

  let best = {
    dist: Number.POSITIVE_INFINITY,
    point: path[0],
    segIndex: 0
  }

  for (let i = 0; i < path.length - 1; i++) {
    const a = toG(path[i])
    const b = toG(path[i + 1])

    for (let s = 0; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment
      const pG = google.maps.geometry.spherical.interpolate(a, b, t)
      const d = google.maps.geometry.spherical.computeDistanceBetween(clickG, pG)

      if (d < best.dist) {
        best = {
          dist: d,
          point: { lat: pG.lat(), lng: pG.lng() },
          segIndex: i
        }
      }
    }
  }

  return best // { dist, point, segIndex }
}

/**
 * Divide um path em 2 partes em cima de um ponto (inserindo o ponto no meio).
 */
export function splitPathAt(
  path: LatLng[],
  split: { point: LatLng; segIndex: number }
) {
  const { point, segIndex } = split

  const partA = [...path.slice(0, segIndex + 1), point]
  const partB = [point, ...path.slice(segIndex + 1)]

  if (partA.length < 2 || partB.length < 2) return null

  return { partA, partB }
}