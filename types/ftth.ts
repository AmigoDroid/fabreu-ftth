// types/ftth.ts
export type LatLng = { lat: number; lng: number }

export type FiberRef = { caboId: number; fibraId: number }

export type FiberCore = {
  id: number              // 1..12
  nome: string            // "Fibra 1" ...
  cor: string             // ABNT
  fusionada: boolean
  fibraFusionadaCom?: FiberRef | null
}

export type FiberSegment = {
  id: number
  nome: string
  descricao: string
  path: LatLng[]
  caboCor?: string
  fibras: FiberCore[]     // 12 fibras (ABNT)
}

export type CEO = {
  id: number
  nome: string
  descricao: string
  position: LatLng

  caboAId: number
  caboBId: number
  
  

  // lista de fusões feitas nesta CEO
  fusoes: Array<{
    aFibraId: number
    bFibraId: number
  }>
}

export type Client = {
  id: number
  nome: string
  position: LatLng
  rx: number
}