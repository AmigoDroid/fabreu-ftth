"use client"

import React, { useMemo, useState } from "react"
import { CEO, FiberSegment, CEOSplitter, SplitterRef, CEOSplitterType, CEOSplitterMode } from "@/types/ftth"

type Props = {
  ceo: CEO
  fibers: FiberSegment[] // fiberList total
  splitter: CEOSplitter

  onChangeType: (ceoId: number, splitterId: string, type: CEOSplitterType) => void
  onChangeMode: (ceoId: number, splitterId: string, mode: CEOSplitterMode) => void

  onSetInput: (ceoId: number, splitterId: string, ref: SplitterRef | null) => void
  onSetOutput: (ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) => void

  onRemove: (ceoId: number, splitterId: string) => void
}

function legsFromType(t: CEOSplitterType) {
  const n = Number(t.replace("1x", ""))
  return Array.from({ length: n }, (_, i) => i + 1)
}

function getCableByPortId(ceo: CEO, fibers: FiberSegment[], portId: string) {
  const p = ceo.ports.find((x) => x.id === portId)
  if (!p?.caboId) return null
  return fibers.find((f) => f.id === p.caboId) ?? null
}

function getFiberColor(ceo: CEO, fibers: FiberSegment[], ref: SplitterRef | null) {
  if (!ref) return "#777"
  const cabo = getCableByPortId(ceo, fibers, ref.portId)
  const cor = cabo?.fibras.find((x) => x.id === ref.fibraId)?.cor
  return cor ?? "#777"
}

export function SplitterEditor({
  ceo,
  fibers,
  splitter,
  onChangeType,
  onChangeMode,
  onSetInput,
  onSetOutput,
  onRemove
}: Props) {
  // só mostra cabos ligados na CEO
  const connectedPorts = useMemo(
    () => ceo.ports.filter((p) => p.caboId != null),
    [ceo.ports]
  )

  const connectedCables = useMemo(() => {
    const list = connectedPorts
      .map((p) => ({
        port: p,
        cabo: fibers.find((f) => f.id === p.caboId) ?? null
      }))
      .filter((x) => x.cabo)

    return list as Array<{ port: typeof connectedPorts[number]; cabo: FiberSegment }>
  }, [connectedPorts, fibers])

  const [activeLeg, setActiveLeg] = useState<number>(() => splitter.outputs[0]?.leg ?? 1)

  const inputColor = useMemo(
    () => getFiberColor(ceo, fibers, splitter.input),
    [ceo, fibers, splitter.input]
  )

  const outColor = (leg: number) => {
    const o = splitter.outputs.find((x) => x.leg === leg)?.target ?? null
    return getFiberColor(ceo, fibers, o)
  }

  const box: React.CSSProperties = {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    background: "#fff"
  }

  const chip = (color: string, active: boolean, disabled: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    border: active ? "2px solid #111" : "1px solid #ddd",
    opacity: disabled ? 0.5 : 1,
    userSelect: "none",
    background: "#fff"
  })

  // alvo da perna ativa
  const activeTarget = splitter.outputs.find((x) => x.leg === activeLeg)?.target ?? null

  return (
    <div style={box}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 14 }}>{""}</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            Splitter {splitter.type} • {splitter.mode === "BALANCED" ? "Balanceado" : "Desbalanceado"}
          </div>
        </div>

        <button
          onClick={() => onRemove(ceo.id, splitter.id)}
          style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
          title="Remover splitter"
        >
          Remover
        </button>
      </div>

      {/* Config */}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <select
          value={splitter.type}
          onChange={(e) => onChangeType(ceo.id, splitter.id, e.target.value as CEOSplitterType)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="1x2">1x2</option>
          <option value="1x4">1x4</option>
          <option value="1x8">1x8</option>
          <option value="1x16">1x16</option>
        </select>

        <select
          value={splitter.mode}
          onChange={(e) => onChangeMode(ceo.id, splitter.id, e.target.value as CEOSplitterMode)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="BALANCED">Balanceado</option>
          <option value="UNBALANCED">Desbalanceado</option>
        </select>
      </div>

      {/* Visual principal */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 260px 1.7fr", gap: 12, marginTop: 12, alignItems: "start" }}>
        {/* ESQUERDA: escolher ENTRADA (branca) */}
        <div>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Entrada do splitter (pino branco)</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Clique em uma fibra de qualquer cabo ligado na CEO para alimentar o splitter.
          </div>

          {connectedCables.length === 0 ? (
            <div style={{ fontSize: 12, color: "#666" }}>Conecte cabos na CEO para habilitar.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {connectedCables.map(({ port, cabo }) => (
                <div key={port.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 8 }}>
                    {port.label} • <span style={{ color: "#555" }}>{cabo.nome}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {cabo.fibras.map((f) => {
                      const ref: SplitterRef = { portId: port.id, fibraId: f.id }
                      const active =
                        splitter.input?.portId === ref.portId && splitter.input?.fibraId === ref.fibraId

                      return (
                        <div
                          key={`${port.id}-${f.id}`}
                          style={chip(f.cor, active, false)}
                          onClick={() => onSetInput(ceo.id, splitter.id, ref)}
                          title="Definir como entrada do splitter"
                        >
                          <span style={{ width: 16, height: 16, borderRadius: 999, background: f.cor, border: "1px solid #333" }} />
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{f.nome}</div>
                          <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                            {active ? "✅ ENTRADA" : "—"}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => onSetInput(ceo.id, splitter.id, null)}
            style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
          >
            Limpar entrada
          </button>
        </div>

        {/* MEIO: desenho do splitter */}
        <div style={{ border: "2px solid #111", borderRadius: 14, padding: 12, background: "#fff", position: "sticky", top: 0 }}>
          <div style={{ fontWeight: 950, textAlign: "center" }}>SPLITTER</div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
            {/* pino branco */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                title="Entrada (branca)"
                style={{ width: 18, height: 18, borderRadius: 999, background: "#fff", border: "2px solid #111" }}
              />
              <div style={{ fontSize: 11, fontWeight: 900 }}>IN</div>
            </div>

            {/* corpo do splitter */}
            <div style={{ flex: 1, margin: "0 10px", height: 100, position: "relative" }}>
              <svg width="100%" height="100%" viewBox="0 0 240 100">
                {/* corpo */}
                <rect x="60" y="10" width="120" height="80" rx="14" fill="#fff" stroke="#111" strokeWidth="2" />
                <text x="120" y="42" textAnchor="middle" fontSize="12" fontWeight="900" fill="#111">
                  {splitter.type}
                </text>
                <text x="120" y="62" textAnchor="middle" fontSize="10" fontWeight="800" fill="#666">
                  {splitter.mode === "BALANCED" ? "BAL" : "UNBAL"}
                </text>

                {/* linhas internas (IN -> outs) */}
                {legsFromType(splitter.type).map((leg) => {
                  const y = 20 + (leg - 0.5) * (60 / legsFromType(splitter.type).length)
                  return (
                    <path
                      key={`in-${leg}`}
                      d={`M 60 50 C 85 50, 95 ${y}, 180 ${y}`}
                      fill="none"
                      stroke={outColor(leg)}
                      strokeWidth="2"
                      opacity="0.9"
                    />
                  )
                })}
              </svg>
            </div>

            {/* pinos de saída */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              {legsFromType(splitter.type).map((leg) => {
                const active = activeLeg === leg
                return (
                  <button
                    key={leg}
                    onClick={() => setActiveLeg(leg)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 10,
                      border: active ? "2px solid #111" : "1px solid #ddd",
                      background: outColor(leg),
                      cursor: "pointer"
                    }}
                    title={`Perna ${leg} (clique para editar)`}
                  />
                )
              })}
              <div style={{ fontSize: 11, fontWeight: 900, marginTop: 4 }}>OUT</div>
            </div>
          </div>

          {/* legenda rápida */}
          <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
            Entrada: <span style={{ fontWeight: 900 }}>{splitter.input ? inputColor : "—"}</span>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                marginLeft: 8,
                borderRadius: 999,
                background: splitter.input ? inputColor : "#fff",
                border: "1px solid #333",
                verticalAlign: "middle"
              }}
            />
          </div>
        </div>

        {/* DIREITA: escolher ALVO da perna ativa */}
        <div>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Saída (perna {activeLeg}) → “fusionar” em qualquer fibra</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Selecione uma fibra de qualquer cabo ligado na CEO para receber esta perna do splitter.
          </div>

          {!splitter.input ? (
            <div style={{ fontSize: 12, color: "#666", border: "1px dashed #ddd", padding: 10, borderRadius: 12 }}>
              Defina primeiro a <b>entrada</b> do splitter (pino branco).
            </div>
          ) : connectedCables.length === 0 ? (
            <div style={{ fontSize: 12, color: "#666" }}>Conecte cabos na CEO para habilitar.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {connectedCables.map(({ port, cabo }) => (
                <div key={port.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 8 }}>
                    {port.label} • <span style={{ color: "#555" }}>{cabo.nome}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {cabo.fibras.map((f) => {
                      const ref: SplitterRef = { portId: port.id, fibraId: f.id }
                      const active =
                        activeTarget?.portId === ref.portId && activeTarget?.fibraId === ref.fibraId

                      return (
                        <div
                          key={`${port.id}-out-${f.id}`}
                          style={chip(f.cor, active, false)}
                          onClick={() => onSetOutput(ceo.id, splitter.id, activeLeg, ref)}
                          title="Definir como alvo desta perna"
                        >
                          <span style={{ width: 16, height: 16, borderRadius: 999, background: f.cor, border: "1px solid #333" }} />
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{f.nome}</div>
                          <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                            {active ? "✅ ALVO" : "—"}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => onSetOutput(ceo.id, splitter.id, activeLeg, null)}
            style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
          >
            Limpar perna {activeLeg}
          </button>
        </div>
      </div>

      {/* Resumo das saídas */}
      <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
        <div style={{ fontWeight: 950 }}>Resumo das pernas</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
          Cada perna pode ir para qualquer fibra (mesmo cabo ou outro).
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {splitter.outputs.map((o) => (
            <div
              key={o.leg}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: "8px 10px",
                display: "flex",
                gap: 8,
                alignItems: "center"
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: getFiberColor(ceo, fibers, o.target),
                  border: "1px solid #333"
                }}
              />
              <div style={{ fontSize: 12, fontWeight: 900 }}>Perna {o.leg}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {o.target ? `${o.target.portId}: Fibra ${o.target.fibraId}` : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}