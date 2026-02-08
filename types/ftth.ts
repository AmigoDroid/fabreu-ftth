// types/ftth.ts
export type LatLng = { lat: number; lng: number }

export type FiberRef = { caboId: number; fibraId: number }

export type FiberCore = {
  id: number // 1..12
  nome: string // "Fibra 1" ...
  cor: string // ABNT
  fusionada: boolean
  fibraFusionadaCom?: FiberRef | null
}

export type FiberSegment = {
  id: number
  nome: string
  descricao: string
  path: LatLng[]
  caboCor?: string
  fibras: FiberCore[] // 12 fibras (ABNT)
}

export type CEOPort = {
  id: string // "IN-1", "OUT-1", "OUT-2"...
  label: string // "Entrada", "Saída 1"...
  direction: "IN" | "OUT"
  caboId: number | null // cabo plugado nessa porta
}

// ✅ fusão referencia porta + fibra
export type CEOFusion = {
  a: { portId: string; fibraId: number } // ex: IN-1 / fibra 1
  b: { portId: string; fibraId: number } // ex: OUT-2 / fibra 1
}

// ✅ splitter
export type CEOSplitterType = "1x2" | "1x4" | "1x8" | "1x16"
export type CEOSplitterMode = "BALANCED" | "UNBALANCED"

export type CEOSplitter = {
  id: string
  portInId: string // ex "IN-1"
  type: CEOSplitterType
  mode: CEOSplitterMode

  // perda típica (aprox). Pode ajustar depois.
  lossDb: number

  // portas OUT que esse splitter alimenta
  outs: string[]

  // só no modo desbalanceado
  // ex: { "OUT-1": 70, "OUT-2": 30 }
  unbalanced?: Record<string, number>
}

export type CEO = {
  id: number
  nome: string
  descricao: string
  position: LatLng

  // ✅ vários cabos via portas
  ports: CEOPort[]

  // ✅ fusões
  fusoes: CEOFusion[]

  // ✅ splitters
  splitters: CEOSplitter[]
}

export type Client = {
  id: number
  nome: string
  position: LatLng
  rx: number
}