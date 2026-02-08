// types/ftth.ts
export type LatLng = {
  lat: number
  lng: number
}

export type FiberSegment = {
  id: number
  nome:string
  descricao:string
  path: LatLng[]
  color: string
}

export type Client = {
  id: number
  nome: string
  position: LatLng
  rx: number
}
export type CEO = {
  id: number
  nome: string
  position: LatLng
  caboId: number
  fusoes: Array<{
    id: number
    nome: string
    fibraNumber: Array<{fibraInNumber: number, fibraOutNumber: number}>
    fibracolor: string
    fibraPath: LatLng[]
  }>
    descricao: string
  }

