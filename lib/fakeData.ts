// lib/fakeData.ts
import { Client, FiberSegment } from "@/types/ftth"
import { gerarFibras } from "@/components/map/gerarfibras"

export const clients: Client[] = [
  {
    id: 1,
    nome: "Cliente 1",
    position: { lat: -23.55, lng: -46.63 },
    rx: -18.5
  }
]

export const fibers: FiberSegment[] = [
  {
    id: 1,
    nome: "teste",
    descricao: "cabo principal",
    caboCor: "#ff5500",
    path: [
      { lat: -23.55, lng: -46.63 },
      { lat: -23.551, lng: -46.631 }
    ],
    fibras: gerarFibras(12)
  }
]