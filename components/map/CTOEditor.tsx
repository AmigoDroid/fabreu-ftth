"use client"

import { useMemo, useState } from "react"
import { CEO, CEOSplitterType, FiberSegment, SplitterRef } from "@/types/ftth"

type Props = {
  ceo: CEO
  fibers: FiberSegment[]
  onClose: () => void
  onAddOutPort: (ceoId: number) => void
  onConnectCable: (ceoId: number, portId: string, caboId: number | null) => void
  onFuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onUnfuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onSetSplitterInputRef: (ceoId: number, splitterId: string, ref: SplitterRef | null) => void
  onSetSplitterOutputRef: (ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) => void
  onAddCTOSecondarySplitter: (ceoId: number, type: "1x8" | "1x16", parentLeg: number) => void
  onRemoveSplitter: (ceoId: number, splitterId: string) => void
}

function fanout(type: CEOSplitterType) {
  return Number(String(type).replace("1x", ""))
}

function legsFromType(type: CEOSplitterType) {
  return Array.from({ length: fanout(type) }, (_, i) => i + 1)
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
  onFuse,
  onUnfuse,
  onSetSplitterInputRef,
  onSetSplitterOutputRef,
  onAddCTOSecondarySplitter,
  onRemoveSplitter
}: Props) {
  const outPorts = useMemo(() => ceo.ports.filter((p) => p.direction === "OUT"), [ceo.ports])
  const inPort = useMemo(() => ceo.ports.find((p) => p.id === "IN-1") ?? null, [ceo.ports])
  const pluggedPorts = useMemo(() => ceo.ports.filter((p) => p.caboId != null), [ceo.ports])

  const [tab, setTab] = useState<"SPLICE" | "SPLITTER">("SPLITTER")
  const [activeOutPortId, setActiveOutPortId] = useState<string>(outPorts[0]?.id ?? "OUT-1")
  const [selA, setSelA] = useState<number | null>(null)
  const [selB, setSelB] = useState<number | null>(null)

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
  const allTraySplitters = useMemo(
    () => ceo.splitters.filter((s) => s.role === "PRIMARY" || s.role === "SECONDARY"),
    [ceo.splitters]
  )
  const [activeTraySplitterId, setActiveTraySplitterId] = useState<string | null>(allTraySplitters[0]?.id ?? null)
  const [trayOutLeg, setTrayOutLeg] = useState<number>(1)

  const activeTraySplitter = useMemo(
    () => (activeTraySplitterId ? allTraySplitters.find((s) => s.id === activeTraySplitterId) ?? null : null),
    [activeTraySplitterId, allTraySplitters]
  )
  const trayLegs = useMemo(
    () => (activeTraySplitter ? legsFromType(activeTraySplitter.type) : []),
    [activeTraySplitter]
  )

  const activeOutPort = useMemo(() => outPorts.find((p) => p.id === activeOutPortId) ?? null, [outPorts, activeOutPortId])

  const caboIN = useMemo(() => {
    if (!inPort?.caboId) return null
    return fibers.find((f) => f.id === inPort.caboId) ?? null
  }, [fibers, inPort])

  const caboOUT = useMemo(() => {
    if (!activeOutPort?.caboId) return null
    return fibers.find((f) => f.id === activeOutPort.caboId) ?? null
  }, [fibers, activeOutPort])

  const usedIN = useMemo(() => {
    const s = new Set<number>()
    for (const f of ceo.fusoes) {
      if (f.a.portId === "IN-1") s.add(f.a.fibraId)
      if (f.b.portId === "IN-1") s.add(f.b.fibraId)
    }
    return s
  }, [ceo.fusoes])

  const usedOUTActive = useMemo(() => {
    const s = new Set<number>()
    for (const f of ceo.fusoes) {
      if (f.a.portId === activeOutPortId) s.add(f.a.fibraId)
      if (f.b.portId === activeOutPortId) s.add(f.b.fibraId)
    }
    return s
  }, [ceo.fusoes, activeOutPortId])

  function tryFuse(aId: number | null, bId: number | null) {
    if (!aId || !bId) return
    if (!activeOutPortId) return
    if (!caboIN || !caboOUT) return
    if (usedIN.has(aId)) return
    if (usedOUTActive.has(bId)) return
    onFuse(ceo.id, "IN-1", aId, activeOutPortId, bId)
    setSelA(null)
    setSelB(null)
  }

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

  function refColor(ref: SplitterRef | null) {
    if (!ref) return "#bbb"
    const cabo = cableByPort.get(ref.portId)
    return cabo?.fibras.find((x) => x.id === ref.fibraId)?.cor ?? "#bbb"
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
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button
              onClick={() => setTab("SPLICE")}
              style={{
                border: "1px solid #ddd",
                background: tab === "SPLICE" ? "#111" : "#fff",
                color: tab === "SPLICE" ? "#fff" : "#111",
                borderRadius: 10,
                padding: "6px 10px",
                cursor: "pointer",
                fontWeight: 900
              }}
            >
              Fusoes
            </button>
            <button
              onClick={() => setTab("SPLITTER")}
              style={{
                border: "1px solid #ddd",
                background: tab === "SPLITTER" ? "#111" : "#fff",
                color: tab === "SPLITTER" ? "#fff" : "#111",
                borderRadius: 10,
                padding: "6px 10px",
                cursor: "pointer",
                fontWeight: 900
              }}
            >
              Splitters CTO
            </button>
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
              <button
                onClick={() => setActiveOutPortId(p.id)}
                style={{
                  width: 90,
                  borderRadius: 10,
                  padding: "6px 8px",
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  background: p.id === activeOutPortId ? "#111" : "#fff",
                  color: p.id === activeOutPortId ? "#fff" : "#111",
                  fontWeight: 900
                }}
              >
                {p.label}
              </button>
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

      {tab === "SPLICE" && (
        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Fusoes de passagem (IN para OUT)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                IN-1 {caboIN ? `| ${caboIN.nome}` : "| sem cabo"}
              </div>
              {!caboIN ? (
                <div style={{ fontSize: 12, color: "#666" }}>Conecte um cabo na entrada para criar fusoes.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {caboIN.fibras.map((f) => {
                    const active = selA === f.id
                    const disabled = usedIN.has(f.id)
                    return (
                      <div
                        key={`in-${f.id}`}
                        style={chipStyle(f.cor, active, disabled)}
                        onClick={() => {
                          if (disabled) return
                          const next = active ? null : f.id
                          setSelA(next)
                          tryFuse(next, selB)
                        }}
                      >
                        <span style={dotStyle(f.cor)} />
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                          {disabled ? "fusionada" : active ? "selecionada" : "-"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                {activeOutPortId} {caboOUT ? `| ${caboOUT.nome}` : "| sem cabo"}
              </div>
              {!caboOUT ? (
                <div style={{ fontSize: 12, color: "#666" }}>Conecte um cabo na saida ativa para criar fusoes.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {caboOUT.fibras.map((f) => {
                    const active = selB === f.id
                    const disabled = usedOUTActive.has(f.id)
                    return (
                      <div
                        key={`out-${activeOutPortId}-${f.id}`}
                        style={chipStyle(f.cor, active, disabled)}
                        onClick={() => {
                          if (disabled) return
                          const next = active ? null : f.id
                          setSelB(next)
                          tryFuse(selA, next)
                        }}
                      >
                        <span style={dotStyle(f.cor)} />
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                          {disabled ? "fusionada" : active ? "selecionada" : "-"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            Dica: essa fusao permite retorno de fibra para atendimento via outra CEO/CTO no caminho.
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {ceo.fusoes.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666" }}>
                Selecione uma fibra do IN-1 e uma da saida ativa para criar a fusao.
              </div>
            ) : (
              ceo.fusoes.map((f, idx) => (
                <div
                  key={`${idx}-${f.a.portId}-${f.a.fibraId}-${f.b.portId}-${f.b.fibraId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: 10,
                    border: "1px solid #eee",
                    borderRadius: 12
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <b>{f.a.portId}</b>:<b>{f.a.fibraId}</b> <span>{"<->"}</span> <b>{f.b.portId}</b>:<b>{f.b.fibraId}</b>
                  </div>
                  <button
                    onClick={() => onUnfuse(ceo.id, f.a.portId, f.a.fibraId, f.b.portId, f.b.fibraId)}
                    style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
                  >
                    Desfazer
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "SPLITTER" && (
        <>
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

          <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Bandeja visual da CTO</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
              Fluxo visual: cabo da esquerda {"->"} splitter (bandeja) {"->"} cabo/conector de atendimento.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {allTraySplitters.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveTraySplitterId(s.id)
                    setTrayOutLeg(1)
                  }}
                  style={{
                    border: "1px solid #ddd",
                    background: s.id === activeTraySplitterId ? "#111" : "#fff",
                    color: s.id === activeTraySplitterId ? "#fff" : "#111",
                    borderRadius: 999,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontWeight: 900
                  }}
                >
                  {s.role === "PRIMARY" ? "Primario" : `Atendimento P${s.parentLeg ?? "-"}`} | {s.type}
                </button>
              ))}
            </div>

            {!activeTraySplitter ? (
              <div style={{ fontSize: 12, color: "#666" }}>Nenhum splitter disponivel para visualizacao.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 1fr", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Esquerda | {leftCable ? leftCable.nome : "sem cabo"}
                  </div>
                  {activeTraySplitter.role === "SECONDARY" ? (
                    <div style={{ fontSize: 12, color: "#666", border: "1px dashed #ddd", borderRadius: 10, padding: 10 }}>
                      Entrada do splitter de atendimento vem da perna {activeTraySplitter.parentLeg ?? "-"} do primario.
                    </div>
                  ) : !leftCable ? (
                    <div style={{ fontSize: 12, color: "#666" }}>Selecione uma porta com cabo na origem do sinal.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {leftCable.fibras.map((f) => {
                        const ref: SplitterRef = { portId: leftPortId, fibraId: f.id }
                        const active = activeTraySplitter.input?.portId === ref.portId && activeTraySplitter.input?.fibraId === ref.fibraId
                        const busy = used.has(refKey(ref)) && !active
                        return (
                          <div
                            key={`tray-in-${leftPortId}-${f.id}`}
                            style={chipStyle(f.cor, active, busy)}
                            onClick={() => {
                              if (busy) return
                              onSetSplitterInputRef(ceo.id, activeTraySplitter.id, ref)
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
                </div>

                <div style={{ border: "2px solid #111", borderRadius: 12, padding: 10, background: "#fff" }}>
                  <div style={{ fontWeight: 900, textAlign: "center" }}>
                    {activeTraySplitter.role === "PRIMARY" ? "SPLITTER PRIMARIO" : `SPLITTER ATENDIMENTO P${activeTraySplitter.parentLeg ?? "-"}`}
                  </div>
                  <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>{activeTraySplitter.type}</div>

                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          border: "2px solid #111",
                          background:
                            activeTraySplitter.role === "PRIMARY"
                              ? refColor(activeTraySplitter.input)
                              : refColor(primary?.input ?? null)
                        }}
                      />
                      <div style={{ fontSize: 11, fontWeight: 900 }}>IN</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                      {trayLegs.map((leg) => {
                        const target = activeTraySplitter.outputs.find((o) => o.leg === leg)?.target ?? null
                        const selected = trayOutLeg === leg
                        return (
                          <button
                            key={`tray-leg-${leg}`}
                            onClick={() => setTrayOutLeg(leg)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 10,
                              border: selected ? "2px solid #111" : "1px solid #ddd",
                              background: target ? refColor(target) : "#fff",
                              cursor: "pointer"
                            }}
                            title={target ? `OUT ${leg} ligada` : `OUT ${leg} livre`}
                          />
                        )
                      })}
                      <div style={{ fontSize: 11, fontWeight: 900 }}>OUT</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Direita | {targetCable ? targetCable.nome : "sem cabo"} | OUT {trayOutLeg}
                  </div>
                  {!targetCable ? (
                    <div style={{ fontSize: 12, color: "#666" }}>Selecione uma porta/cabo de atendimento.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {targetCable.fibras.map((f) => {
                        const ref: SplitterRef = { portId: targetPortId, fibraId: f.id }
                        const current = activeTraySplitter.outputs.find((o) => o.leg === trayOutLeg)?.target ?? null
                        const active = current?.portId === ref.portId && current?.fibraId === ref.fibraId
                        const busy = used.has(refKey(ref)) && !active
                        const sameFiberAsInput = primaryInputEquals(ref)
                        const blockedBySignal =
                          activeTraySplitter.role === "PRIMARY"
                            ? !activeTraySplitter.input
                            : !primary?.input
                        const disabled = busy || sameFiberAsInput || blockedBySignal

                        return (
                          <div
                            key={`tray-out-${targetPortId}-${f.id}`}
                            style={chipStyle(f.cor, active, disabled)}
                            onClick={() => {
                              if (disabled) return
                              onSetSplitterOutputRef(ceo.id, activeTraySplitter.id, trayOutLeg, ref)
                            }}
                          >
                            <span style={dotStyle(f.cor)} />
                            <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                            <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                              {active ? `OUT ${trayOutLeg}` : blockedBySignal ? "sem IN" : busy ? "ocupada" : "-"}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => onSetSplitterOutputRef(ceo.id, activeTraySplitter.id, trayOutLeg, null)}
                    style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
                  >
                    Limpar OUT {trayOutLeg}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
