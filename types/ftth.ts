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

export type BoxKind = "CEO" | "CTO"

export type BoxFormData = {
  nome: string
  codigo: string
  tipo: BoxKind
  fabricante: string
  modelo: string
  origemSinal: string
  areaAtendimento: string
  descricao: string
}

export type SplitterRef = { portId: string; fibraId: number }
export type CEOSplitterType = "1x2" | "1x4" | "1x8" | "1x16"
export type CEOSplitterMode = "BALANCED" | "UNBALANCED"
export type CEOSplitterRole = "DEFAULT" | "PRIMARY" | "SECONDARY"

export type CEOSplitterOutput = {
  leg: number
  target: SplitterRef | null
}

export type CEOSplitter = {
  id: string
  type: CEOSplitterType
  mode: CEOSplitterMode
  role?: CEOSplitterRole
  parentLeg?: number | null
  lossDb: number
  input: SplitterRef | null
  outputs: CEOSplitterOutput[]
  unbalanced?: Record<number, number>
}

export type CTOCableTubeSize = 2 | 4 | 6 | 12

export type CTOCableTubeConfig = {
  cableId: number
  tubeSize: CTOCableTubeSize
}

export type CTODropStatus = "PLANEJADO" | "INSTALADO" | "ATIVO" | "MANUTENCAO"
export type CTOTerminationType = "CONECTOR" | "FIBRA_NUA"
export type CTOConnectorType = "APC" | "UPC"

export type CTODrop = {
  id: string
  splitterId: string
  leg: number
  target: SplitterRef | null
  clientName: string
  clientCode?: string
  status: CTODropStatus
  notes?: string
}

export type CTOLegConfig = {
  splitterId: string
  leg: number
  termination: CTOTerminationType
}

export type CTOSplitterConfig = {
  splitterId: string
  connectorized: boolean
  connectorType: CTOConnectorType
  docName?: string
  docCode?: string
  docModel?: string
  docNotes?: string
}

export type CTOModel = {
  cableTubes: CTOCableTubeConfig[]
  drops: CTODrop[]
  legConfigs?: CTOLegConfig[]
  splitterConfigs?: CTOSplitterConfig[]
  explicitlyUnfed?: boolean
}

export type CEO = {
  id: number
  tipo: BoxKind
  nome: string
  codigo?: string
  fabricante?: string
  modelo?: string
  origemSinal?: string
  areaAtendimento?: string
  descricao: string
  position: LatLng
  ports: CEOPort[]
  fusoes: CEOFusion[]
  splitters: CEOSplitter[]
  ctoModel?: CTOModel
}

export type Client = {
  id: number
  nome: string
  position: LatLng
  rx: number
}
