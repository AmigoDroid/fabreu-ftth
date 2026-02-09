// types/ftth.ts
export type LatLng = { lat: number; lng: number }

export type FiberRef = { caboId: number; fibraId: number }

export type FiberCore = {
  id: number
  nome: string
  cor: string
  fusionada: boolean
  fibraFusionadaCom?: FiberRef | null
}

export type FiberSegment = {
  id: number
  nome: string
  descricao: string
  tipoCabo?: string
  fabricante?: string
  modelo?: string
  origem?: string
  destino?: string
  path: LatLng[]
  caboCor?: string
  fibras: FiberCore[]
}

export type CEOPort = {
  id: string
  label: string
  direction: "IN" | "OUT"
  caboId: number | null
}

export type CEOFusion = {
  a: { portId: string; fibraId: number }
  b: { portId: string; fibraId: number }
}

// ======================
// SPLITTER (dentro da CEO)
// ======================
export type SplitterRef = { portId: string; fibraId: number }
export type CEOSplitterType = "1x2" | "1x4" | "1x8" | "1x16"
export type CEOSplitterMode = "BALANCED" | "UNBALANCED"

export type CEOSplitterOutput = {
  leg: number
  target: SplitterRef | null
}

export type CEOSplitter = {
  id: string
  type: CEOSplitterType
  mode: CEOSplitterMode
  lossDb: number
  input: SplitterRef | null
  outputs: CEOSplitterOutput[]
  unbalanced?: Record<number, number>
}

export type CEO = {
  id: number
  nome: string
  descricao: string
  position: LatLng
  ports: CEOPort[]
  fusoes: CEOFusion[]
  splitters: CEOSplitter[]
}

export type Client = {
  id: number
  nome: string
  position: LatLng
  rx: number
}