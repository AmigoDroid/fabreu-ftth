import { CEO, CTODrop, CTOModel, CTOTerminationType, FiberSegment, SplitterRef } from "@/types/ftth"

export type ValidationItem = {
  id: string
  ok: boolean
  label: string
  detail: string
}

export type PathStep = {
  key: string
  label: string
}

export function refKey(ref: SplitterRef) {
  return `${ref.portId}::${ref.fibraId}`
}

export function getLegTermination(model: CTOModel | undefined, splitterId: string, leg: number): CTOTerminationType {
  const cfg = model?.legConfigs?.find((x) => x.splitterId === splitterId && x.leg === leg)
  return cfg?.termination ?? "CONECTOR"
}

export function hasFeedingCable(ceo: CEO) {
  return ceo.ports.some((p) => p.direction === "IN" && p.caboId != null)
}

export function buildValidationReport(ceo: CEO, model: CTOModel | undefined) {
  const items: ValidationItem[] = []
  const primary = ceo.splitters.find((s) => s.role === "PRIMARY") ?? null
  const secondaries = ceo.splitters.filter((s) => s.role === "SECONDARY")
  const drops = model?.drops ?? []
  const isUnfed = Boolean(model?.explicitlyUnfed)

  items.push({
    id: "feed",
    ok: hasFeedingCable(ceo) || isUnfed,
    label: "Alimentacao da CTO",
    detail: hasFeedingCable(ceo) ? "Existe cabo de entrada conectado." : isUnfed ? "Marcada como nao alimentada." : "Sem cabo de entrada e sem marcacao de nao alimentada."
  })

  items.push({
    id: "primary",
    ok: primary != null,
    label: "Splitter primario",
    detail: primary ? `Configurado (${primary.type}).` : "Nao configurado."
  })

  items.push({
    id: "secondary",
    ok: secondaries.length > 0,
    label: "Splitter de atendimento",
    detail: secondaries.length > 0 ? `${secondaries.length} splitter(s) de atendimento.` : "Nenhum splitter de atendimento configurado."
  })

  const dropsWithInvalidLeg = drops.filter((d) => {
    const s = ceo.splitters.find((x) => x.id === d.splitterId)
    if (!s) return true
    return !s.outputs.some((o) => o.leg === d.leg)
  })
  items.push({
    id: "drop-leg",
    ok: dropsWithInvalidLeg.length === 0,
    label: "Leg de atendimento",
    detail: dropsWithInvalidLeg.length === 0 ? "Todos os drops apontam para pernas validas." : `${dropsWithInvalidLeg.length} drop(s) com perna invalida.`
  })

  const duplicateDrops = new Set<string>()
  const seen = new Set<string>()
  for (const d of drops) {
    const key = `${d.splitterId}:${d.leg}`
    if (seen.has(key)) duplicateDrops.add(key)
    seen.add(key)
  }
  items.push({
    id: "drop-unique",
    ok: duplicateDrops.size === 0,
    label: "Uma perna por cliente",
    detail: duplicateDrops.size === 0 ? "Nao ha pernas duplicadas em drops." : "Existem pernas duplicadas em drops."
  })

  const hasPathCandidate = drops.every((d) => dropHasValidOpticalHint(ceo, d, model))
  items.push({
    id: "path",
    ok: hasPathCandidate,
    label: "Caminho optico minimo",
    detail: hasPathCandidate ? "Todos os drops possuem trilha minima de conexao." : "Existem drops sem trilha optica valida."
  })

  return items
}

function dropHasValidOpticalHint(ceo: CEO, drop: CTODrop, model: CTOModel | undefined) {
  const splitter = ceo.splitters.find((s) => s.id === drop.splitterId)
  if (!splitter) return false
  const out = splitter.outputs.find((o) => o.leg === drop.leg)
  if (!out) return false
  const termination = getLegTermination(model, drop.splitterId, drop.leg)
  if (termination === "CONECTOR") return true
  return out.target != null
}

export function traceDropPath(ceo: CEO, drop: CTODrop, model: CTOModel | undefined) {
  const steps: PathStep[] = []
  const splitter = ceo.splitters.find((s) => s.id === drop.splitterId)
  if (!splitter) return steps

  const termination = getLegTermination(model, drop.splitterId, drop.leg)
  const primary = ceo.splitters.find((s) => s.role === "PRIMARY") ?? null

  steps.push({ key: "src", label: "Entrada CTO (IN-1)" })

  if (splitter.role === "SECONDARY" && splitter.parentLeg != null && primary) {
    steps.push({ key: "p-in", label: `Splitter primario ${primary.type} (entrada)` })
    steps.push({ key: "p-leg", label: `Perna ${splitter.parentLeg} do primario` })
    steps.push({ key: "s-in", label: `Splitter atendimento ${splitter.type} (entrada)` })
  } else {
    steps.push({ key: "s-in-direct", label: `Splitter atendimento ${splitter.type} (alimentacao direta/fusao)` })
  }

  steps.push({ key: "s-out", label: `Perna OUT ${drop.leg}` })
  steps.push({ key: "term", label: termination === "CONECTOR" ? "Terminacao conectorizada" : "Terminacao em fibra nua" })

  if (termination === "FIBRA_NUA") {
    const out = splitter.outputs.find((o) => o.leg === drop.leg)
    if (out?.target) {
      steps.push({ key: "fusion", label: `Fusao para ${out.target.portId} F${out.target.fibraId}` })
    } else {
      steps.push({ key: "fusion-missing", label: "Sem fusao definida para continuidade" })
    }
  } else {
    steps.push({ key: "drop", label: "Drop/cliente conectado por conector" })
  }

  return steps
}

export function cableByPort(ceo: CEO, fibers: FiberSegment[]) {
  const map = new Map<string, FiberSegment | null>()
  for (const p of ceo.ports) {
    const cable = p.caboId ? fibers.find((f) => f.id === p.caboId) ?? null : null
    map.set(p.id, cable)
  }
  return map
}
