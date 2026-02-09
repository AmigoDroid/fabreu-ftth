"use client"

import { useMemo, useState } from "react"
import { CEO, CEOSplitterType, FiberSegment, SplitterRef } from "@/types/ftth"

type Props = {
  ceo: CEO
  fibers: FiberSegment[]
  onClose: () => void
  onAddOutPort: (ceoId: number) => void
  onConnectCable: (ceoId: number, portId: string, caboId: number | null) => void
  onSetSplitterInputRef: (ceoId: number, splitterId: string, ref: SplitterRef | null) => void
  onSetSplitterOutputRef: (ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) => void
  onAddCTOSecondarySplitter: (ceoId: number, type: "1x8" | "1x16", parentLeg: number) => void
  onRemoveSplitter: (ceoId: number, splitterId: string) => void
}

function fanout(type: CEOSplitterType) {
  return Number(String(type).replace("1x", ""))
}

function chipStyle(color: string, active: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    border: active ? "2px solid #111" : "1px solid #ddd",
    opacity: disabled ? 0.55 : 1,
    background: "#fff",
    userSelect: "none"
  }
}

function dotStyle(color: string): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    borderRadius: 999,
    background: color,
    border: "1px solid #333"
  }
}

function refKey(ref: SplitterRef) {
  return `${ref.portId}::${ref.fibraId}`
}

export function CTOEditor({
  ceo,
  fibers,
  onClose,
  onAddOutPort,
  onConnectCable,
  onSetSplitterInputRef,
  onSetSplitterOutputRef,
  onAddCTOSecondarySplitter,
  onRemoveSplitter
}: Props) {
  const outPorts = useMemo(() => ceo.ports.filter((p) => p.direction === "OUT"), [ceo.ports])
  const inPort = useMemo(() => ceo.ports.find((p) => p.id === "IN-1") ?? null, [ceo.ports])
  const pluggedPorts = useMemo(() => ceo.ports.filter((p) => p.caboId != null), [ceo.ports])

  const cableByPort = useMemo(() => {
    const map = new Map<string, FiberSegment | null>()
    for (const p of ceo.ports) {
      const cabo = p.caboId ? fibers.find((f) => f.id === p.caboId) ?? null : null
      map.set(p.id, cabo)
    }
    return map
  }, [ceo.ports, fibers])

  const primary = useMemo(() => ceo.splitters.find((s) => s.role === "PRIMARY") ?? null, [ceo.splitters])
  const secondaries = useMemo(
    () => ceo.splitters.filter((s) => s.role === "SECONDARY").sort((a, b) => (a.parentLeg ?? 0) - (b.parentLeg ?? 0)),
    [ceo.splitters]
  )

  const [leftPortId, setLeftPortId] = useState<string>(pluggedPorts[0]?.id ?? "IN-1")
  const [secondaryType, setSecondaryType] = useState<"1x8" | "1x16">("1x8")
  const [secondaryLeg, setSecondaryLeg] = useState<number>(1)
  const [activeSecondaryId, setActiveSecondaryId] = useState<string | null>(secondaries[0]?.id ?? null)
  const [activeOutLeg, setActiveOutLeg] = useState<number>(1)
  const [targetPortId, setTargetPortId] = useState<string>(pluggedPorts[0]?.id ?? "OUT-1")

  const activeSecondary = useMemo(
    () => (activeSecondaryId ? secondaries.find((s) => s.id === activeSecondaryId) ?? null : null),
    [activeSecondaryId, secondaries]
  )

  const used = useMemo(() => {
    const s = new Set<string>()

    for (const f of ceo.fusoes) {
      s.add(`${f.a.portId}::${f.a.fibraId}`)
      s.add(`${f.b.portId}::${f.b.fibraId}`)
    }

    for (const spl of ceo.splitters) {
      if (spl.input) s.add(refKey(spl.input))
      for (const o of spl.outputs) {
        if (o.target) s.add(refKey(o.target))
      }
    }

    return s
  }, [ceo.fusoes, ceo.splitters])

  const leftCable = leftPortId ? cableByPort.get(leftPortId) ?? null : null
  const targetCable = targetPortId ? cableByPort.get(targetPortId) ?? null : null

  const freePrimaryLegs = useMemo(() => {
    const usedLegs = new Set<number>(secondaries.map((s) => s.parentLeg ?? 0))
    return Array.from({ length: 8 }, (_, i) => i + 1).filter((leg) => !usedLegs.has(leg))
  }, [secondaries])

  const panel: React.CSSProperties = {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 1000,
    width: 760,
    maxHeight: "85vh",
    overflow: "auto",
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #e5e5e5",
    boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
    padding: 14
  }

  function primaryInputEquals(ref: SplitterRef) {
    return !!primary?.input && primary.input.portId === ref.portId && primary.input.fibraId === ref.fibraId
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{ceo.nome} (CTO)</div>
          <div style={{ fontSize: 12, color: "#555" }}>{ceo.descricao}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Codigo: <b>{ceo.codigo ?? "-"}</b> | Origem: <b>{ceo.origemSinal ?? "-"}</b> | Atendimento: <b>{ceo.areaAtendimento ?? "-"}</b>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
        >
          Fechar
        </button>
      </div>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Cabos na CTO</div>
          <button
            onClick={() => onAddOutPort(ceo.id)}
            style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
          >
            + Saida
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <div style={{ width: 90, fontWeight: 900 }}>Entrada</div>
          <select
            value={inPort?.caboId ?? ""}
            onChange={(e) => onConnectCable(ceo.id, "IN-1", e.target.value ? Number(e.target.value) : null)}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="">- sem cabo -</option>
            {fibers.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {outPorts.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 90, fontWeight: 900 }}>{p.label}</div>
              <select
                value={p.caboId ?? ""}
                onChange={(e) => onConnectCable(ceo.id, p.id, e.target.value ? Number(e.target.value) : null)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
              >
                <option value="">- sem cabo -</option>
                {fibers.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Splitter primario 1x8</div>

        {!primary ? (
          <div style={{ fontSize: 12, color: "#666" }}>Primario nao encontrado na CTO.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Porta de origem do sinal</div>
                <select
                  value={leftPortId}
                  onChange={(e) => setLeftPortId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  {pluggedPorts.map((p) => (
                    <option key={p.id} value={p.id}>{p.label} ({p.id})</option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: 12, color: "#666" }}>
                Entrada atual: <b>{primary.input ? `${primary.input.portId} / Fibra ${primary.input.fibraId}` : "nao definida"}</b>
              </div>
            </div>

            {!leftCable ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Selecione uma porta plugada para definir a entrada.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {leftCable.fibras.map((f) => {
                  const ref: SplitterRef = { portId: leftPortId, fibraId: f.id }
                  const active = primary.input?.portId === ref.portId && primary.input?.fibraId === ref.fibraId
                  const busy = used.has(refKey(ref)) && !active

                  return (
                    <div
                      key={`${leftPortId}-${f.id}`}
                      style={chipStyle(f.cor, active, busy)}
                      onClick={() => {
                        if (busy) return
                        onSetSplitterInputRef(ceo.id, primary.id, ref)
                      }}
                    >
                      <span style={dotStyle(f.cor)} />
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{active ? "IN" : busy ? "ocupada" : "-"}</div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => onSetSplitterInputRef(ceo.id, primary.id, null)}
              style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
            >
              Limpar entrada primario
            </button>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((leg) => {
                const sec = secondaries.find((s) => s.parentLeg === leg)
                return (
                  <div key={leg} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>Perna {leg}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {sec ? `${sec.type} (${sec.id})` : "sem secundario"}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Splitters secundarios (atendimento)</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Tipo</div>
            <select
              value={secondaryType}
              onChange={(e) => setSecondaryType(e.target.value as "1x8" | "1x16")}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="1x8">1x8</option>
              <option value="1x16">1x16</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Perna do primario</div>
            <select
              value={secondaryLeg}
              onChange={(e) => setSecondaryLeg(Number(e.target.value))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              {freePrimaryLegs.map((leg) => (
                <option key={leg} value={leg}>Perna {leg}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onAddCTOSecondarySplitter(ceo.id, secondaryType, secondaryLeg)}
            disabled={freePrimaryLegs.length === 0}
            style={{ border: "1px solid #ddd", background: "#111", color: "#fff", borderRadius: 10, padding: "8px 10px", cursor: "pointer", fontWeight: 900 }}
          >
            + Adicionar
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {secondaries.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSecondaryId(s.id)}
              style={{
                border: "1px solid #ddd",
                background: s.id === activeSecondaryId ? "#111" : "#fff",
                color: s.id === activeSecondaryId ? "#fff" : "#111",
                borderRadius: 999,
                padding: "6px 10px",
                cursor: "pointer",
                fontWeight: 900
              }}
            >
              {s.type} | P{String(s.parentLeg ?? "-")}
            </button>
          ))}
        </div>

        {!activeSecondary ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Selecione um secundario para conectar atendimento.</div>
        ) : (
          <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>
                Secundario {activeSecondary.type} na perna {activeSecondary.parentLeg}
              </div>
              <button
                onClick={() => {
                  onRemoveSplitter(ceo.id, activeSecondary.id)
                  setActiveSecondaryId((prev) => (prev === activeSecondary.id ? null : prev))
                }}
                style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
              >
                Remover
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Perna de saida ativa</div>
                <select
                  value={activeOutLeg}
                  onChange={(e) => setActiveOutLeg(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  {Array.from({ length: fanout(activeSecondary.type) }, (_, i) => i + 1).map((leg) => (
                    <option key={leg} value={leg}>OUT {leg}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Porta/cabo de atendimento</div>
                <select
                  value={targetPortId}
                  onChange={(e) => setTargetPortId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  {pluggedPorts.map((p) => (
                    <option key={p.id} value={p.id}>{p.label} ({p.id})</option>
                  ))}
                </select>
              </div>
            </div>

            {!targetCable ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Selecione uma porta com cabo para conectar clientes.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {targetCable.fibras.map((f) => {
                  const ref: SplitterRef = { portId: targetPortId, fibraId: f.id }
                  const current = activeSecondary.outputs.find((o) => o.leg === activeOutLeg)?.target ?? null
                  const active = current?.portId === ref.portId && current?.fibraId === ref.fibraId
                  const busy = used.has(refKey(ref)) && !active
                  const sameFiberAsInput = primaryInputEquals(ref)
                  const disabled = busy || sameFiberAsInput

                  return (
                    <div
                      key={`${targetPortId}-${f.id}`}
                      style={chipStyle(f.cor, active, disabled)}
                      onClick={() => {
                        if (disabled) return
                        onSetSplitterOutputRef(ceo.id, activeSecondary.id, activeOutLeg, ref)
                      }}
                      title={sameFiberAsInput ? "Mesmo cabo e mesma fibra de entrada nao e permitido." : ""}
                    >
                      <span style={dotStyle(f.cor)} />
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                        {active ? `OUT ${activeOutLeg}` : sameFiberAsInput ? "entrada" : busy ? "ocupada" : "-"}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => onSetSplitterOutputRef(ceo.id, activeSecondary.id, activeOutLeg, null)}
              style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
            >
              Limpar OUT {activeOutLeg}
            </button>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
          Regra: fibras usadas em fusoes/splitters ficam bloqueadas ate desfazer a conexao. E permitido retornar no mesmo cabo, desde que seja outra fibra.
        </div>
      </div>
    </div>
  )
}
