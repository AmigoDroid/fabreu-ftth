"use client"

import React, { useLayoutEffect, useMemo, useRef, useState } from "react"
import { CEO, FiberSegment, CEOSplitter, PortFiberRef, SplitterType } from "@/types/ftth"

type Props = {
  ceo: CEO
  fibers: FiberSegment[] // fiberList total
  splitter: CEOSplitter

  onSetInput: (ceoId: number, splitterId: string, ref: PortFiberRef | null) => void
  onSetOutput: (ceoId: number, splitterId: string, leg: number, ref: PortFiberRef | null) => void
}

type Pt = { x: number; y: number }

function legsFromType(t: SplitterType) {
  const n = Number(t.replace("1x", ""))
  return Array.from({ length: n }, (_, i) => i + 1)
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

function getCableByPortId(ceo: CEO, fibers: FiberSegment[], portId: string) {
  const p = ceo.ports.find((x) => x.id === portId)
  if (!p?.caboId) return null
  return fibers.find((f) => f.id === p.caboId) ?? null
}

function getFiberColor(ceo: CEO, fibers: FiberSegment[], ref: PortFiberRef | null) {
  if (!ref) return "#777"
  const cabo = getCableByPortId(ceo, fibers, ref.portId)
  const cor = cabo?.fibras.find((x) => x.id === ref.fibraId)?.cor
  return cor ?? "#777"
}

export function SplitterWiringEditor({ ceo, fibers, splitter, onSetInput, onSetOutput }: Props) {
  // só portas com cabo plugado (pra não confundir)
  const connectedPorts = useMemo(() => ceo.ports.filter((p) => p.caboId != null), [ceo.ports])

  const connected = useMemo(() => {
    return connectedPorts
      .map((p) => ({ port: p, cabo: fibers.find((f) => f.id === p.caboId) ?? null }))
      .filter((x) => x.cabo) as Array<{ port: (typeof connectedPorts)[number]; cabo: FiberSegment }>
  }, [connectedPorts, fibers])

  // porta esquerda/direita
  const [leftPortId, setLeftPortId] = useState<string>(() => connected[0]?.port.id ?? "")
  const [rightPortId, setRightPortId] = useState<string>(() => connected[1]?.port.id ?? connected[0]?.port.id ?? "")

  // garante ids válidos quando muda a lista
  useMemo(() => {
    if (connected.length === 0) return
    if (!connected.some((x) => x.port.id === leftPortId)) setLeftPortId(connected[0].port.id)
    if (!connected.some((x) => x.port.id === rightPortId)) setRightPortId((connected[1] ?? connected[0]).port.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected.map((x) => x.port.id).join("|")])

  const leftCable = useMemo(() => (leftPortId ? getCableByPortId(ceo, fibers, leftPortId) : null), [ceo, fibers, leftPortId])
  const rightCable = useMemo(() => (rightPortId ? getCableByPortId(ceo, fibers, rightPortId) : null), [ceo, fibers, rightPortId])

  // seleção “igual fusão de 2 cabos”
  const [selLeftFiberId, setSelLeftFiberId] = useState<number | null>(null)

  const legs = legsFromType(splitter.type)
  const [activeLeg, setActiveLeg] = useState<number>(() => splitter.outputs?.[0]?.leg ?? 1)

  const inputColor = useMemo(() => getFiberColor(ceo, fibers, splitter.input ?? null), [ceo, fibers, splitter.input])

  const legTarget = (leg: number) => splitter.outputs.find((o) => o.leg === leg)?.target ?? null
  const legColor = (leg: number) => getFiberColor(ceo, fibers, legTarget(leg))

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

        // 1) Linha: fibra de entrada (esquerda) -> pino branco do splitter
        if (splitter.input) {
          const inChip = diagramEl.querySelector<HTMLElement>(`[data-left="${splitter.input.portId}:${splitter.input.fibraId}"]`)
          const pinIn = diagramEl.querySelector<HTMLElement>(`[data-spl-in="1"]`)
          if (inChip && pinIn) {
            const aRect = inChip.getBoundingClientRect()
            const bRect = pinIn.getBoundingClientRect()
            next.push({
              key: `in-${splitter.id}`,
              a: { x: aRect.right - baseRect.left, y: aRect.top - baseRect.top + aRect.height / 2 },
              b: { x: bRect.left - baseRect.left, y: bRect.top - baseRect.top + bRect.height / 2 },
              color: inputColor ?? "#777"
            })
          }
        }

        // 2) Linhas: pernas do splitter -> fibras no cabo da direita
        for (const leg of legs) {
          const tgt = legTarget(leg)
          if (!tgt) continue

          const pinLeg = diagramEl.querySelector<HTMLElement>(`[data-spl-leg="${leg}"]`)
          const outChip = diagramEl.querySelector<HTMLElement>(`[data-right="${tgt.portId}:${tgt.fibraId}"]`)
          if (!pinLeg || !outChip) continue

          const aRect = pinLeg.getBoundingClientRect()
          const bRect = outChip.getBoundingClientRect()

          next.push({
            key: `leg-${splitter.id}-${leg}`,
            a: { x: aRect.right - baseRect.left, y: aRect.top - baseRect.top + aRect.height / 2 },
            b: { x: bRect.left - baseRect.left, y: bRect.top - baseRect.top + bRect.height / 2 },
            color: legColor(leg)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitter.id, splitter.type, splitter.input, splitter.outputs, leftPortId, rightPortId, inputColor])

  const panel: React.CSSProperties = {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    maxHeight: "70vh",
    overflow: "auto"
  }

  if (connected.length === 0) {
    return (
      <div style={panel}>
        <div style={{ fontWeight: 900 }}>Splitter</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
          Conecte cabos na CEO para conseguir fazer as ligações do splitter.
        </div>
      </div>
    )
  }

  return (
    <div ref={panelRef} style={panel}>
      {/* Top controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 14 }}>Ligação do Splitter</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {splitter.type} • {splitter.mode === "BALANCED" ? "Balanceado" : "Desbalanceado"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#555" }}>Perna ativa:</div>
          <select
            value={activeLeg}
            onChange={(e) => setActiveLeg(Number(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 800 }}
          >
            {legs.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* escolher cabos esquerda/direita */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Cabo da esquerda (ENTRADA)</div>
          <select
            value={leftPortId}
            onChange={(e) => setLeftPortId(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            {connected.map(({ port, cabo }) => (
              <option key={port.id} value={port.id}>
                {port.label} • {cabo.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Cabo da direita (SAÍDA)</div>
          <select
            value={rightPortId}
            onChange={(e) => setRightPortId(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            {connected.map(({ port, cabo }) => (
              <option key={port.id} value={port.id}>
                {port.label} • {cabo.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DIAGRAMA TRIPLO */}
      <div ref={diagramRef} style={{ position: "relative", marginTop: 12 }}>
        {/* SVG linhas */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }}>
          {lines.map((ln) => {
            const mid = (ln.b.x - ln.a.x) * 0.35
            const c1x = ln.a.x + mid
            const c2x = ln.b.x - mid
            const d = `M ${ln.a.x} ${ln.a.y} C ${c1x} ${ln.a.y}, ${c2x} ${ln.b.y}, ${ln.b.x} ${ln.b.y}`
            return <path key={ln.key} d={d} fill="none" stroke={ln.color} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
          })}
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px 1fr", gap: 12, alignItems: "start" }}>
          {/* ESQUERDA */}
          <div>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              {leftCable ? leftCable.nome : "—"}
              <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>
                Clique numa fibra para virar ENTRADA (pino branco)
              </div>
            </div>

            {!leftCable ? (
              <div style={{ fontSize: 12, color: "#666" }}>Selecione uma porta com cabo.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leftCable.fibras.map((f) => {
                  const ref: PortFiberRef = { portId: leftPortId, fibraId: f.id }
                  const isInput = splitter.input?.portId === ref.portId && splitter.input?.fibraId === ref.fibraId
                  const active = selLeftFiberId === f.id || isInput

                  return (
                    <div
                      key={f.id}
                      data-left={`${leftPortId}:${f.id}`}
                      style={chipStyle(f.cor, active, false)}
                      onClick={() => {
                        // define entrada do splitter
                        onSetInput(ceo.id, splitter.id, ref)
                        setSelLeftFiberId(f.id) // só pra feedback visual
                      }}
                      title="Definir como entrada do splitter"
                    >
                      <span style={{ width: 16, height: 16, borderRadius: 999, background: f.cor, border: "1px solid #333" }} />
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{f.nome}</div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{isInput ? "⬜ IN" : "—"}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SPLITTER MEIO */}
          <div style={{ position: "sticky", top: 0, alignSelf: "start", zIndex: 3 }}>
            <div style={{ border: "2px solid #111", borderRadius: 14, padding: 12, background: "#fff" }}>
              <div style={{ fontWeight: 950, textAlign: "center" }}>SPLITTER</div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
                {/* pino branco */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div
                    data-spl-in="1"
                    title="Entrada (branca)"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: "#fff",
                      border: "2px solid #111"
                    }}
                  />
                  <div style={{ fontSize: 11, fontWeight: 900 }}>IN</div>
                </div>

                {/* corpo */}
                <div style={{ flex: 1, margin: "0 10px", height: 120 }}>
                  <svg width="100%" height="100%" viewBox="0 0 240 120">
                    <rect x="60" y="10" width="120" height="100" rx="14" fill="#fff" stroke="#111" strokeWidth="2" />
                    <text x="120" y="44" textAnchor="middle" fontSize="14" fontWeight="900" fill="#111">
                      {splitter.type}
                    </text>
                    <text x="120" y="68" textAnchor="middle" fontSize="10" fontWeight="800" fill="#666">
                      {splitter.mode === "BALANCED" ? "BALANCED" : "UNBALANCED"}
                    </text>

                    {/* linhas internas */}
                    {legs.map((leg) => {
                      const y = 25 + (leg - 0.5) * (80 / legs.length)
                      return (
                        <path
                          key={`line-${leg}`}
                          d={`M 60 60 C 85 60, 95 ${y}, 180 ${y}`}
                          fill="none"
                          stroke={legColor(leg)}
                          strokeWidth="2"
                          opacity="0.9"
                        />
                      )
                    })}
                  </svg>
                </div>

                {/* pinos OUT */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  {legs.map((leg) => {
                    const active = activeLeg === leg
                    return (
                      <button
                        key={leg}
                        data-spl-leg={leg}
                        onClick={() => setActiveLeg(leg)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 10,
                          border: active ? "2px solid #111" : "1px solid #ddd",
                          background: legColor(leg),
                          cursor: "pointer"
                        }}
                        title={`Perna ${leg} (clique para tornar ativa)`}
                      />
                    )
                  })}
                  <div style={{ fontSize: 11, fontWeight: 900, marginTop: 4 }}>OUT</div>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
                Entrada atual:
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
                <span style={{ marginLeft: 8, fontWeight: 900 }}>{splitter.input ? inputColor : "—"}</span>
              </div>
            </div>
          </div>

          {/* DIREITA */}
          <div>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              {rightCable ? rightCable.nome : "—"}
              <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>
                Clique numa fibra para ligar a <b>Perna {activeLeg}</b>
              </div>
            </div>

            {!splitter.input ? (
              <div style={{ fontSize: 12, color: "#666", border: "1px dashed #ddd", padding: 10, borderRadius: 12 }}>
                Primeiro defina a <b>entrada</b> do splitter (clique numa fibra do cabo da esquerda).
              </div>
            ) : !rightCable ? (
              <div style={{ fontSize: 12, color: "#666" }}>Selecione uma porta com cabo.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rightCable.fibras.map((f) => {
                  const ref: PortFiberRef = { portId: rightPortId, fibraId: f.id }
                  const tgt = legTarget(activeLeg)
                  const active = tgt?.portId === ref.portId && tgt?.fibraId === ref.fibraId

                  return (
                    <div
                      key={f.id}
                      data-right={`${rightPortId}:${f.id}`}
                      style={chipStyle(f.cor, active, false)}
                      onClick={() => {
                        onSetOutput(ceo.id, splitter.id, activeLeg, ref)
                      }}
                      title={`Ligar Perna ${activeLeg} aqui`}
                    >
                      <span style={{ width: 16, height: 16, borderRadius: 999, background: f.cor, border: "1px solid #333" }} />
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{f.nome}</div>
                      <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{active ? `✅ OUT ${activeLeg}` : "—"}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DICA */}
      <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}
      >Dica: você pode colocar <b>esquerda</b> e <b>direita</b> no mesmo cabo se quiser derivar dentro do mesmo cabo.
      </div>
    </div>
  )
}