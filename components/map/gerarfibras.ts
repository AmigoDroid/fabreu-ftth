import { FiberCore } from "@/types/ftth"
import { ABNT_12 } from "./fiberPalette"

export function gerarFibras(total: number): FiberCore[] {
  return Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    nome: `Fibra ${i + 1}`,
    cor: ABNT_12[i % ABNT_12.length],
    fusionada: false,
    fibraFusionadaCom: null
  }))
}