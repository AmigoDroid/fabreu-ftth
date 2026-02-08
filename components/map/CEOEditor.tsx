"use client"

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  CEO,
  FiberSegment,
  CEOSplitterType,
  CEOSplitterMode
} from "@/types/ftth"

type Pt = { x: number; y: number }

type Props = {
  ceo: CEO
  fibers: FiberSegment[] // TODOS os cabos existentes
  onClose: () => void

  // portas
  onAddOutPort: (ceoId: number) => void
  onConnectCable: (ceoId: number, portId: string, caboId: number | null) => void

  // fusões porta+fibra
  onFuse: (
    ceoId: number,
    aPortId: string,
    aFibraId: number,
    bPortId: string,
    bFibraId: number
  ) => void
  onUnfuse: (
    ceoId: number,
    aPortId: string,
    aFibraId: number,
    bPortId: string,
    bFibraId: number
  ) => void

  // splitters
  onAddSplitter: (ceoId: number, type: CEOSplitterType, mode: CEOSplitterMode) => void
  onRemoveSplitter: (ceoId: number, splitterId: string) => void
  onUpdateSplitterUnbalanced: (ceoId: number, splitterId: string, outPortId: string, value: number) => void
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
    opacity: disabled ? 0.5 : 1,
    background: "#fff",
    userSelect: "none"
  }
}

export function CEOEditor({
  ceo,
  fibers,
  onClose,
  onAddOutPort,
  onConnectCable,
  onFuse,
  onUnfuse,
  onAddSplitter,
  onRemoveSplitter,
  onUpdateSplitterUnbalanced
}: Props) {
  const outPorts = useMemo(() => ceo.ports.filter((p) => p.direction === "OUT"), [ceo.ports])
  const inPort = useMemo(() => ceo.ports.find((p) => p.id === "IN-1") ?? null, [ceo.ports])

  const [activeOutPortId, setActiveOutPortId] = useState<string>(() => outPorts[0]?.id ?? "OUT-1")

  // ✅ mantém um OUT válido selecionado
  useEffect(() => {
    if (!outPorts.some((p) => p.id === activeOutPortId)) {
      setActiveOutPortId(outPorts[0]?.id ?? "OUT-1")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outPorts.map((p) => p.id).join("|")])

  const activeOutPort = outPorts.find((p) => p.id === activeOutPortId) ?? null

  const caboIN = useMemo(() => {
    if (!inPort?.caboId) return null
    return fibers.find((f) => f.id === inPort.caboId) ?? null
  }, [fibers, inPort?.caboId])

  const caboOUT = useMemo(() => {
    if (!activeOutPort?.caboId) return null
    return fibers.find((f) => f.id === activeOutPort.caboId) ?? null
  }, [fibers, activeOutPort?.caboId])

  // ===== seleção de fibras para fusionar =====
  const [selA, setSelA] = useState<number | null>(null)
  const [selB, setSelB] = useState<number | null>(null)

  // ✅ mapas de fusões filtrados para IN-1 <-> OUT ativo (pra desenhar linhas)
  const fusedInToOut = useMemo(() => {
    const m = new Map<number, number>()
    for (const f of ceo.fusoes) {
      if (f.a.portId === "IN-1" && f.b.portId === activeOutPortId) m.set(f.a.fibraId, f.b.fibraId)
      if (f.b.portId === "IN-1" && f.a.portId === activeOutPortId) m.set(f.b.fibraId, f.a.fibraId)
    }
    return m
  }, [ceo.fusoes, activeOutPortId])

  const fusedOutToIn = useMemo(() => {
    const m = new Map<number, number>()
    for (const f of ceo.fusoes) {
      if (f.a.portId === activeOutPortId && f.b.portId === "IN-1") m.set(f.a.fibraId, f.b.fibraId)
      if (f.b.portId === activeOutPortId && f.a.portId === "IN-1") m.set(f.b.fibraId, f.a.fibraId)
    }
    return m
  }, [ceo.fusoes, activeOutPortId])

  // ✅ usado globalmente (evitar IN repetido em qualquer OUT)
  const usedIN = useMemo(() => {
    const s = new Set<number>()
    for (const f of ceo.fusoes) {
      if (f.a.portId === "IN-1") s.add(f.a.fibraId)
      if (f.b.portId === "IN-1") s.add(f.b.fibraId)
    }
    return s
  }, [ceo.fusoes])

  // ✅ usado apenas no OUT ativo (evitar OUT repetido na mesma saída)
  const usedOUTActive = useMemo(() => {
    const s = new Set<number>()
    for (const f of ceo.fusoes) {
      if (f.a.portId === activeOutPortId) s.add(f.a.fibraId)
      if (f.b.portId === activeOutPortId) s.add(f.b.fibraId)
    }
    return s
  }, [ceo.fusoes, activeOutPortId])

  function getColorIN(fibraId: number) {
    return caboIN?.fibras.find((x) => x.id === fibraId)?.cor ?? "#111"
  }

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

  // ====== linhas (SVG) ======
  const panelRef = useRef<HTMLDivElement | null>(null)
  const diagramRef = useRef<HTMLDivElement | null>(null)
  const [lines, setLines] = useState<Array<{ key: string; a: Pt; b: Pt; color: string }>>([])

  useLayoutEffect(() => {
    const panelEl = panelRef.current
    const diagramEl = diagramRef.current
    if (!panelEl || !diagramEl) return

    let raf = 0
    const calc = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const baseRect = diagramEl.getBoundingClientRect()
        const next: Array<{ key: string; a: Pt; b: Pt; color: string }> = []

        for (const [aFibraId, bFibraId] of fusedInToOut.entries()) {
          const aEl = diagramEl.querySelector<HTMLElement>(`[data-in="${aFibraId}"]`)
          const bEl = diagramEl.querySelector<HTMLElement>(`[data-out="${bFibraId}"]`)
          if (!aEl || !bEl) continue

          const aRect = aEl.getBoundingClientRect()
          const bRect = bEl.getBoundingClientRect()

          const a: Pt = {
            x: aRect.right - baseRect.left,
            y: aRect.top - baseRect.top + aRect.height / 2
          }
          const b: Pt = {
            x: bRect.left - baseRect.left,
            y: bRect.top - baseRect.top + bRect.height / 2
          }

          next.push({
            key: `${ceo.id}-${activeOutPortId}-${aFibraId}-${bFibraId}`,
            a,
            b,
            color: getColorIN(aFibraId)
          })
        }

        setLines(next)
      })
    }

    calc()
    const onScroll = () => calc()
    panelEl.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", calc, { passive: true })

    const ro = new ResizeObserver(() => calc())
    ro.observe(diagramEl)

    return () => {
      cancelAnimationFrame(raf)
      panelEl.removeEventListener("scroll", onScroll as any)
      window.removeEventListener("resize", calc as any)
      ro.disconnect()
    }
  }, [ceo.id, activeOutPortId, fusedInToOut, caboIN?.fibras, caboOUT?.fibras])

  // ====== UI splitter ======
  const [splType, setSplType] = useState<CEOSplitterType>("1x2")
  const [splMode, setSplMode] = useState<CEOSplitterMode>("BALANCED")

  const panel: React.CSSProperties = {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 1000,
    width: 660,
    maxHeight: "85vh",
    overflow: "auto",
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #e5e5e5",
    boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
    padding: 14
  }

  return (
    <div ref={panelRef} style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{ceo.nome}</div>
          <div style={{ fontSize: 12, color: "#555" }}>{ceo.descricao}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
            Selecione <b>IN</b> e depois <b>OUT</b> para fusionar (na saída ativa).
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
        >
          Fechar
        </button>
      </div>

      {/* PORTAS / CABOS */}
      <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Cabos na CEO</div>
          <button
            onClick={() => onAddOutPort(ceo.id)}
            style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
          >
            + Saída
          </button>
        </div>

        {/* Entrada */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <div style={{ width: 90, fontWeight: 800 }}>Entrada</div>
          <select
            value={inPort?.caboId ?? ""}
            onChange={(e) => onConnectCable(ceo.id, "IN-1", e.target.value ? Number(e.target.value) : null)}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="">— sem cabo —</option>
            {fibers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Saídas */}
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
                  fontWeight: 800
                }}
                title="Selecionar esta saída para fazer fusões"
              >
                {p.label}
              </button>

              <select
                value={p.caboId ?? ""}
                onChange={(e) => onConnectCable(ceo.id, p.id, e.target.value ? Number(e.target.value) : null)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
              >
                <option value="">— sem cabo —</option>
                {fibers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ SPLITTERS */}
      <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Splitters</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Tipo</div>
            <select
              value={splType}
              onChange={(e) => setSplType(e.target.value as CEOSplitterType)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="1x2">1x2</option>
              <option value="1x4">1x4</option>
              <option value="1x8">1x8</option>
              <option value="1x16">1x16</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Modo</div>
            <select
              value={splMode}
              onChange={(e) => setSplMode(e.target.value as CEOSplitterMode)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="BALANCED">Balanceado</option>
              <option value="UNBALANCED">Desbalanceado</option>
            </select>
          </div>

          <button
            onClick={() => onAddSplitter(ceo.id, splType, splMode)}
            style={{
              border: "1px solid #ddd",
              background: "#111",
              color: "#fff",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 800
            }}
          >
            + Adicionar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {(ceo.splitters ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: "#666" }}>Nenhum splitter cadastrado nesta CEO.</div>
          ) : (
            (ceo.splitters ?? []).map((s) => {
              const outs = s.outs ?? []
              return (
                <div key={s.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 13 }}>
                      <b>{s.type}</b> • {s.mode === "BALANCED" ? "Balanceado" : "Desbalanceado"} • Perda:{" "}
                      <b>{(s.lossDb ?? 0).toFixed(1)} dB</b>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                        IN: <b>{s.portInId}</b> → OUTs: <b>{outs.join(", ") || "—"}</b>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveSplitter(ceo.id, s.id)}
                      style={{
                        border: "1px solid #ddd",
                        background: "#fff",
                        borderRadius: 10,
                        padding: "6px 10px",
                        cursor: "pointer"
                      }}
                    >
                      Remover
                    </button>
                  </div>

                  {s.mode === "UNBALANCED" && outs.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 8 }}>
                        Divisão por saída (%)
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {outs.map((outId) => {
                          const v = Number((s.unbalanced ?? {})[outId] ?? 0)
                          return (
                            <div
                              key={outId}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "90px 1fr 70px",
                                gap: 8,
                                alignItems: "center"
                              }}
                            >
                              <div style={{ fontWeight: 800 }}>{outId}</div>

                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={v}
                                onChange={(e) =>
                                  onUpdateSplitterUnbalanced(ceo.id, s.id, outId, Number(e.target.value))
                                }
                              />

                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={v}
                                onChange={(e) =>
                                  onUpdateSplitterUnbalanced(ceo.id, s.id, outId, Number(e.target.value))
                                }
                                style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid #ddd" }}
                              />
                            </div>
                          )
                        })}
                      </div>

                      <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                        Exemplo: OUT-1 70% / OUT-2 30%. (Depois a gente liga isso no cálculo de perda por saída.)
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* DIAGRAMA (linhas de fusão) */}
      <div
        ref={diagramRef}
        style={{
          position: "relative",
          marginTop: 12,
          minHeight: 420 // ✅ garante altura pro SVG aparecer
        }}
      >
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }}>
          {lines.map((ln) => {
            const mid = (ln.b.x - ln.a.x) * 0.35
            const c1x = ln.a.x + mid
            const c2x = ln.b.x - mid
            const d = `M ${ln.a.x} ${ln.a.y} C ${c1x} ${ln.a.y}, ${c2x} ${ln.b.y}, ${ln.b.x} ${ln.b.y}`
            return <path key={ln.key} d={d} fill="none" stroke={ln.color} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
          })}
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 12, alignItems: "start" }}>
          {/* IN */}
          <div>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              IN-1 {caboIN ? `• ${caboIN.nome}` : "• (sem cabo)"}
            </div>

            {!caboIN ? (
              <div style={{ fontSize: 12, color: "#666" }}>Conecte um cabo na Entrada para liberar as fibras.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {caboIN.fibras.map((f) => {
                  const active = selA === f.id
                  const disabled = usedIN.has(f.id)
                  return (
                    <div
                      key={f.id}
                      data-in={f.id}
                      style={chipStyle(f.cor, active, disabled)}
                      onClick={() => {
                        if (disabled) return
                        const next = active ? null : f.id
                        setSelA(next)
                        tryFuse(next, selB)
                      }}
                      title={disabled ? "Esta fibra de entrada já está fusionada em alguma saída." : "Clique para selecionar"}
                    >
                      <span style={{ width: 16, height: 16, borderRadius: 999, background: f.cor, border: "1px solid #333" }} />
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{f.nome}</div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                        {fusedInToOut.has(f.id) ? `🔗 ${activeOutPortId} ${fusedInToOut.get(f.id)}` : "—"}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* CEO bloco */}
          <div style={{ position: "sticky", top: 0, alignSelf: "start", zIndex: 3, height: "fit-content" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "2px solid #111",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                background: "#fff"
              }}
              title="CEO"
            >
              CEO
            </div>
          </div>

          {/* OUT ativo */}
          <div>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              {activeOutPort?.id ?? "OUT"} {caboOUT ? `• ${caboOUT.nome}` : "• (sem cabo)"}
            </div>

            {!caboOUT ? (
              <div style={{ fontSize: 12, color: "#666" }}>Conecte um cabo na {activeOutPort?.label ?? "saída"} para liberar as fibras.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {caboOUT.fibras.map((f) => {
                  const active = selB === f.id
                  const disabled = usedOUTActive.has(f.id)
                  return (
                    <div
                      key={f.id}
                      data-out={f.id}
                      style={chipStyle(f.cor, active, disabled)}
                      onClick={() => {
                        if (disabled) return
                        const next = active ? null : f.id
                        setSelB(next)
                        tryFuse(selA, next)
                      }}
                      title={disabled ? "Esta fibra já está fusionada nesta saída." : "Clique para selecionar"}
                    >
                      <span style={{ width: 16, height: 16, borderRadius: 999, background: f.cor, border: "1px solid #333" }} />
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{f.nome}</div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                        {fusedOutToIn.has(f.id) ? `🔗 IN ${fusedOutToIn.get(f.id)}` : "—"}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LISTA DE FUSÕES */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Fusões</div>

        {ceo.fusoes.length === 0 ? (
          <div style={{ fontSize: 12, color: "#666" }}>
            Selecione uma fibra do IN-1 e depois uma fibra da saída (OUT) ativa para criar a fusão.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ceo.fusoes.map((f, idx) => (
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
                  <b>{f.a.portId}</b>:<b>{f.a.fibraId}</b> ↔ <b>{f.b.portId}</b>:<b>{f.b.fibraId}</b>
                </div>
                <button
                  onClick={() => onUnfuse(ceo.id, f.a.portId, f.a.fibraId, f.b.portId, f.b.fibraId)}
                  style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
                >
                  Desfazer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}