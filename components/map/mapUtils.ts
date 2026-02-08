// components/map/mapUtils.ts

export type LatLng = {
  lat: number
  lng: number
}

/**
 * Retorna o ponto central visual da fibra
 */
export function getFiberCenter(path: LatLng[]): LatLng | null {
  if (!path || path.length === 0) return null
  return path[Math.floor(path.length / 2)]
}

/**
 * Calcula o comprimento total da fibra em METROS
 * Aqui NÃO existe perda, só distância
 */
export function calcularComprimento(path: LatLng[]): number {
  if (!path || path.length < 2) return 0

  let total = 0

  for (let i = 1; i < path.length; i++) {
    const p1 = new google.maps.LatLng(
      path[i - 1].lat,
      path[i - 1].lng
    )

    const p2 = new google.maps.LatLng(
      path[i].lat,
      path[i].lng
    )

    total += google.maps.geometry.spherical.computeDistanceBetween(
      p1,
      p2
    )
  }

  return total // metros
}

/**
 * Calcula a perda total da fibra (em dB)
 * ⚠️ Por padrão NÃO existe perda nenhuma
 */
export function calcularPerdaFibra(
  comprimentoMetros: number,
  options?: {
    atenuacaoPorKm?: number // ex: 0.35 dB/km
    emendas?: number       // ex: 2
    perdaPorEmenda?: number // ex: 0.1 dB
    splitters?: number[]   // ex: [3.5, 7.2]
  }
): number {
  if (!options) return 0

  const {
    atenuacaoPorKm = 0,
    emendas = 0,
    perdaPorEmenda = 0,
    splitters = []
  } = options

  const perdaFibra =
    (comprimentoMetros / 1000) * atenuacaoPorKm

  const perdaEmendas =
    emendas * perdaPorEmenda

  const perdaSplitters =
    splitters.reduce((acc, v) => acc + v, 0)

  return (
    perdaFibra +
    perdaEmendas +
    perdaSplitters
  )
}