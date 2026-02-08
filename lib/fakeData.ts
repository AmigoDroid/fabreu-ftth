// lib/fakeData.ts (ou onde estiver seus dados)
import { gerarFibras } from "@/components/map/gerarfibras"
import { FiberSegment } from "@/types/ftth"

export const fibers: FiberSegment[] = [
  {
    id: 1,
    nome: "teste",
    descricao: "cabo principal",
    caboCor: "#ff5500", // (se você mudou de color -> caboCor)
    path: [
      { lat: -23.55, lng: -46.63 },
      { lat: -23.551, lng: -46.631 }
    ],
    fibras: gerarFibras(12) // ✅ obrigatório agora
  }
]