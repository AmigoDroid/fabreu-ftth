"use client"

import React, { useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  CEO,
  FiberSegment,
  CEOSplitterMode,
  CEOSplitterType,
  SplitterRef
} from "@/types/ftth"

type Pt = { x: number; y: number }

type Props = {
  ceo: CEO
  fibers: FiberSegment[] // TODOS os cabos da rede (mas o editor filtra só os plugados)
  onClose: () => void

  // portas
  onAddOutPort: (ceoId: number) => void
  onConnectCable: (ceoId: number, portId: string, caboId: number | null) => void

  // fusões normais
  onFuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onUnfuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void

  // splitters
  onAddSplitter: (ceoId: number, type: CEOSplitterType, mode: CEOSplitterMode) => void
  onRemoveSplitter: (ceoId: number, splitterId: string) => void
  onSetSplitterInputRef: (ceoId: number, splitterId: string, ref: SplitterRef | null) => void
  onSetSplitterOutputRef: (ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) => void
  onSetSplitterLegUnbalanced: (ceoId: number, splitterId: string, leg: number, percent: number) => void
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

function dotStyle(color: string, white = false): React.CSSProperties {
  return {
    width: 16,
    height: 16,
    borderRadius: 999,
    background: white ? "#ffffff" : color,
    border: "1px solid #333"
  }
}

function legsFromType(t: CEOSplitterType) {
  const n = Number(String(t).replace("1x", ""))
  const safe = Number.isFinite(n) && n > 0 ? n : 2
  return Array.from({ length: safe }, (_, i) => i + 1)
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
  onSetSplitterInputRef,
  onSetSplitterOutputRef,
  onSetSplitterLegUnbalanced
}: Props) {
  // ===== Ports =====
  const outPorts = useMemo(() => ceo.ports.filter((p) => p.direction === "OUT"), [ceo.ports])
  const inPort = useMemo(() => ceo.ports.find((p) => p.id === "IN-1") ?? null, [ceo.ports])

  const [activeOutPortId, setActiveOutPortId] = useState<string>(() => outPorts[0]?.id ?? "OUT-1")
  const [tab, setTab] = useState<"SPLICE" | "SPLITTER">("SPLICE")

  // garante OUT ativo válido
  useMemo(() => {
    if (!outPorts.some((p) => p.id === activeOutPortId)) setActiveOutPortId(outPorts[0]?.id ?? "OUT-1")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outPorts.map((p) => p.id).join("|")])

  const activeOutPort = outPorts.find((p) => p.id === activeOutPortId) ?? null

  // ===== Filtrar cabos: só os plugados na CEO =====
  const pluggedPorts = useMemo(() => ceo.ports.filter((p) => p.caboId != null), [ceo.ports])

  const pluggedCableIds = useMemo(() => {
    const ids = new Set<number>()
    for (const p of pluggedPorts) if (p.caboId != null) ids.add(p.caboId)
    return ids
  }, [pluggedPorts])

  const fibersPlugged = useMemo(() => fibers.filter((f) => pluggedCableIds.has(f.id)), [fibers, pluggedCableIds])

  const caboIN = useMemo(() => {
    if (!inPort?.caboId) return null
    return fibers.find((f) => f.id === inPort.caboId) ?? null
  }, [fibers, inPort?.caboId])

  const caboOUT = useMemo(() => {
    if (!activeOutPort?.caboId) return null
    return fibers.find((f) => f.id === activeOutPort.caboId) ?? null
  }, [fibers, activeOutPort?.caboId])

  // ===== splice selection =====
  const [selA, setSelA] = useState<number | null>(null)
  const [selB, setSelB] = useState<number | null>(null)

  // IN já usado em qualquer OUT
  const usedIN = useMemo(() => {
    const s = new Set<number>()
    for (const f of ceo.fusoes) {
      if (f.a.portId === "IN-1") s.add(f.a.fibraId)
      if (f.b.portId === "IN-1") s.add(f.b.fibraId)
    }
    return s
  }, [ceo.fusoes])

  // usado no OUT ativo
  const usedOUTActive = useMemo(() => {
    const s = new Set<number>()
    for (const f of ceo.fusoes) {
      if (f.a.portId === activeOutPortId) s.add(f.a.fibraId)
      if (f.b.portId === activeOutPortId) s.add(f.b.fibraId)
    }
    return s
  }, [ceo.fusoes, activeOutPortId])

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

  // ===== splitter UI (criar / selecionar) =====
  const [splitType, setSplitType] = useState<CEOSplitterType>("1x2")
  const [splitMode, setSplitMode] = useState<CEOSplitterMode>("BALANCED")
  const [activeSplitterId, setActiveSplitterId] = useState<string | null>(() => ceo.splitters[0]?.id ?? null)

  useMemo(() => {
    if (activeSplitterId && ceo.splitters.some((s) => s.id === activeSplitterId)) return
    setActiveSplitterId(ceo.splitters[0]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ceo.splitters.map((s) => s.id).join("|")])

  const activeSplitter = activeSplitterId ? ceo.splitters.find((s) => s.id === activeSplitterId) ?? null : null

  const splitterLegs = useMemo(() => (activeSplitter ? legsFromType(activeSplitter.type) : []), [activeSplitter])

  const [activeLeg, setActiveLeg] = useState<number>(1)
  useMemo(() => {
    if (!activeSplitter) return
    const legs = legsFromType(activeSplitter.type)
    if (!legs.includes(activeLeg)) setActiveLeg(legs[0] ?? 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSplitter?.type])

  // ===== splitter visual: escolher cabo esquerda/direita (somente plugados) =====
  const pluggedPortIds = useMemo(() => pluggedPorts.map((p) => p.id), [pluggedPorts])

  const [leftPortId, setLeftPortId] = useState<string>(() => pluggedPortIds[0] ?? "IN-1")
  const [rightPortId, setRightPortId] = useState<string>(() => pluggedPortIds[1] ?? pluggedPortIds[0] ?? "OUT-1")

  useMemo(() => {
    if (pluggedPortIds.length === 0) return
    if (!pluggedPortIds.includes(leftPortId)) setLeftPortId(pluggedPortIds[0])
    if (!pluggedPortIds.includes(rightPortId)) setRightPortId(pluggedPortIds[1] ?? pluggedPortIds[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluggedPortIds.join("|")])

  const cableByPortId = useMemo(() => {
    const map = new Map<string, FiberSegment | null>()
    for (const p of ceo.ports) {
      const cabo = p.caboId ? fibers.find((f) => f.id === p.caboId) ?? null : null
      map.set(p.id, cabo)
    }
    return map
  }, [ceo.ports, fibers])

  const leftCable = useMemo(() => (leftPortId ? (cableByPortId.get(leftPortId) ?? null) : null), [leftPortId, cableByPortId])
  const rightCable = useMemo(() => (rightPortId ? (cableByPortId.get(rightPortId) ?? null) : null), [rightPortId, cableByPortId])

  function refLabel(ref: SplitterRef | null) {
    if (!ref) return "—"
    return `${ref.portId} / Fibra ${ref.fibraId}`
  }

  function refColor(ref: SplitterRef | null) {
    if (!ref) return "#777"
    const cabo = cableByPortId.get(ref.portId)
    const cor = cabo?.fibras.find((x) => x.id === ref.fibraId)?.cor
    return cor ?? "#777"
  }

  function getLegTarget(leg: number) {
    if (!activeSplitter) return null
    return activeSplitter.outputs.find((o) => o.leg === leg)?.target ?? null
  }

  // ===== linhas (SVG) splice + splitter =====
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

        // ========== SPLICE LINES ==========
        if (tab === "SPLICE") {
          for (const [aFibraId, bFibraId] of fusedInToOut.entries()) {
            const aEl = diagramEl.querySelector<HTMLElement>(`[data-sp-in="${aFibraId}"]`)
            const bEl = diagramEl.querySelector<HTMLElement>(`[data-sp-out="${bFibraId}"]`)
            if (!aEl || !bEl) continue

            const aRect = aEl.getBoundingClientRect()
            const bRect = bEl.getBoundingClientRect()

            next.push({
              key: `splice-${ceo.id}-${activeOutPortId}-${aFibraId}-${bFibraId}`,
              a: { x: aRect.right - baseRect.left, y: aRect.top - baseRect.top + aRect.height / 2 },
              b: { x: bRect.left - baseRect.left, y: bRect.top - baseRect.top + bRect.height / 2 },
              color: getColorIN(aFibraId)
            })
          }
        }

        // ========== SPLITTER LINES ==========
        if (tab === "SPLITTER" && activeSplitter) {
          // 1) entrada do splitter (fibra esquerda -> pino branco)
          if (activeSplitter.input) {
            const inChip = diagramEl.querySelector<HTMLElement>(
              `[data-spl-left="${activeSplitter.input.portId}:${activeSplitter.input.fibraId}"]`
            )
            const pinIn = diagramEl.querySelector<HTMLElement>(`[data-spl-pin-in="1"]`)
            if (inChip && pinIn) {
              const aRect = inChip.getBoundingClientRect()
              const bRect = pinIn.getBoundingClientRect()
              next.push({
                key: `spl-in-${activeSplitter.id}`,
                a: { x: aRect.right - baseRect.left, y: aRect.top - baseRect.top + aRect.height / 2 },
                b: { x: bRect.left - baseRect.left, y: bRect.top - baseRect.top + bRect.height / 2 },
                color: refColor(activeSplitter.input)
              })
            }
          }

          // 2) cada perna -> fibra direita alvo
          for (const leg of splitterLegs) {
            const tgt = getLegTarget(leg)
            if (!tgt) continue

            const pinLeg = diagramEl.querySelector<HTMLElement>(`[data-spl-leg="${leg}"]`)
            const outChip = diagramEl.querySelector<HTMLElement>(`[data-spl-right="${tgt.portId}:${tgt.fibraId}"]`)
            if (!pinLeg || !outChip) continue

            const aRect = pinLeg.getBoundingClientRect()
            const bRect = outChip.getBoundingClientRect()

            next.push({
              key: `spl-leg-${activeSplitter.id}-${leg}`,
              a: { x: aRect.right - baseRect.left, y: aRect.top - baseRect.top + aRect.height / 2 },
              b: { x: bRect.left - baseRect.left, y: bRect.top - baseRect.top + bRect.height / 2 },
              color: refColor(tgt)
            })
          }
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
  }, [
    tab,
    ceo.id,
    activeOutPortId,
    fusedInToOut,
    activeSplitter?.id,
    activeSplitter?.type,
    activeSplitter?.input,
    activeSplitter?.outputs,
    splitterLegs,
    cableByPortId,
    caboIN?.fibras,
    caboOUT?.fibras,
    leftPortId,
    rightPortId
  ])

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

  return (
    <div ref={panelRef} style={panel}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{ceo.nome}</div>
          <div style={{ fontSize: 12, color: "#555" }}>{ceo.descricao}</div>

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
              Fusões
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
              Splitters
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 10,
            padding: "6px 10px",
            cursor: "pointer"
          }}
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
          <div style={{ width: 90, fontWeight: 900 }}>Entrada</div>
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
                  fontWeight: 900
                }}
                title="Selecionar esta saída"
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

      {/* DIAGRAMA BASE */}
      <div ref={diagramRef} style={{ position: "relative", marginTop: 12 }}>
        {/* SVG */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }}>
          {lines.map((ln) => {
            const mid = (ln.b.x - ln.a.x) * 0.35
            const c1x = ln.a.x + mid
            const c2x = ln.b.x - mid
            const d = `M ${ln.a.x} ${ln.a.y} C ${c1x} ${ln.a.y}, ${c2x} ${ln.b.y}, ${ln.b.x} ${ln.b.y}`
            return <path key={ln.key} d={d} fill="none" stroke={ln.color} strokeWidth={3} strokeLinecap="round" opacity={0.92} />
          })}
        </svg>

        {/* ================== TAB: SPLICE ================== */}
        {tab === "SPLICE" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: 12, alignItems: "start" }}>
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
                        data-sp-in={f.id}
                        style={chipStyle(f.cor, active, disabled)}
                        onClick={() => {
                          if (disabled) return
                          const next = active ? null : f.id
                          setSelA(next)
                          tryFuse(next, selB)
                        }}
                        title={disabled ? "Esta fibra de entrada já está fusionada em alguma saída." : "Clique para selecionar"}
                      >
                        <span style={dotStyle(f.cor)} />
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                          {fusedInToOut.has(f.id) ? `🔗 OUT ${fusedInToOut.get(f.id)}` : "—"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* CEO */}
            <div style={{ position: "sticky", top: 0, alignSelf: "start", zIndex: 3, height: "fit-content" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: "2px solid #111",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  background: "#fff"
                }}
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
                <div style={{ fontSize: 12, color: "#666" }}>Conecte um cabo na saída selecionada para liberar as fibras.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {caboOUT.fibras.map((f) => {
                    const active = selB === f.id
                    const disabled = usedOUTActive.has(f.id)
                    return (
                      <div
                        key={f.id}
                        data-sp-out={f.id}
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
                          {fusedOutToIn.has(f.id) ? `🔗 IN ${fusedOutToIn.get(f.id)}` : "—"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================== TAB: SPLITTER ================== */}
        {tab === "SPLITTER" && (
          <div style={{ marginTop: 2 }}>
            {/* CREATE SPLITTER */}
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Adicionar Splitter</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 10, alignItems: "center" }}>
                <select
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as CEOSplitterType)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="1x2">1x2</option>
                  <option value="1x4">1x4</option>
                  <option value="1x8">1x8</option>
                  <option value="1x16">1x16</option>
                </select>

                <select
                  value={splitMode}
                  onChange={(e) => setSplitMode(e.target.value as CEOSplitterMode)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                >
                  <option value="BALANCED">Balanceado</option>
                  <option value="UNBALANCED">Desbalanceado</option>
                </select>

                <button
                  onClick={() => onAddSplitter(ceo.id, splitType, splitMode)}
                  style={{
                    border: "1px solid #ddd",
                    background: "#111",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontWeight: 900
                  }}
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {/* LISTA SPLITTERS */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ceo.splitters.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSplitterId(s.id)}
                  style={{
                    border: "1px solid #ddd",
                    background: s.id === activeSplitterId ? "#111" : "#fff",
                    color: s.id === activeSplitterId ? "#fff" : "#111",
                    borderRadius: 999,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontWeight: 900
                  }}
                  title="Selecionar splitter"
                >
                  {s.type} • {s.mode === "BALANCED" ? "BAL" : "DES"} • {s.lossDb.toFixed(1)}dB
                </button>
              ))}
            </div>

            {!activeSplitter ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Nenhum splitter selecionado.</div>
            ) : (
              <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                {/* header splitter */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>
                    Splitter {activeSplitter.type} ({activeSplitter.mode === "BALANCED" ? "Balanceado" : "Desbalanceado"}) • Loss{" "}
                    {activeSplitter.lossDb.toFixed(2)} dB
                  </div>

                  <button
                    onClick={() => onRemoveSplitter(ceo.id, activeSplitter.id)}
                    style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
                  >
                    Remover
                  </button>
                </div>

                {/* seletores esquerda/direita + perna ativa */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 220px", gap: 10, marginTop: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Cabo da esquerda (fonte)</div>
                    <select
                      value={leftPortId}
                      onChange={(e) => setLeftPortId(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      {pluggedPorts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Cabo da direita (alvos)</div>
                    <select
                      value={rightPortId}
                      onChange={(e) => setRightPortId(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                    >
                      {pluggedPorts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Perna ativa</div>
                    <select
                      value={activeLeg}
                      onChange={(e) => setActiveLeg(Number(e.target.value))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 900 }}
                    >
                      {splitterLegs.map((leg) => (
                        <option key={leg} value={leg}>
                          OUT {leg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ======= Visual 3 colunas: cabo L / splitter / cabo R ======= */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 1fr", gap: 12, marginTop: 12, alignItems: "start" }}>
                  {/* LEFT cable fibers */}
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>
                      Esquerda • {leftCable ? leftCable.nome : "(sem cabo)"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                      Clique numa fibra para virar a <b>entrada branca</b> do splitter.
                    </div>

                    {!leftCable ? (
                      <div style={{ fontSize: 12, color: "#666" }}>Selecione uma porta plugada.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {leftCable.fibras.map((f) => {
                          const ref: SplitterRef = { portId: leftPortId, fibraId: f.id }
                          const active = activeSplitter.input?.portId === ref.portId && activeSplitter.input?.fibraId === ref.fibraId

                          return (
                            <div
                              key={f.id}
                              data-spl-left={`${leftPortId}:${f.id}`}
                              style={chipStyle(f.cor, active, false)}
                              onClick={() => onSetSplitterInputRef(ceo.id, activeSplitter.id, ref)}
                              title="Definir como entrada do splitter"
                            >
                              <span style={dotStyle(f.cor)} />
                              <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                              <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{active ? "⬜ IN" : "—"}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <button
                      onClick={() => onSetSplitterInputRef(ceo.id, activeSplitter.id, null)}
                      style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
                    >
                      Limpar entrada
                    </button>
                  </div>

                  {/* SPLITTER middle */}
                  <div style={{ position: "sticky", top: 0, alignSelf: "start", zIndex: 3 }}>
                    <div style={{ border: "2px solid #111", borderRadius: 14, padding: 12, background: "#fff" }}>
                      <div style={{ fontWeight: 950, textAlign: "center" }}>SPLITTER</div>
                      <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>
                        {activeSplitter.type} • {activeSplitter.mode === "BALANCED" ? "BAL" : "DES"} • {activeSplitter.lossDb.toFixed(1)} dB
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
                        {/* pino branco */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div
                            data-spl-pin-in="1"
                            title={activeSplitter.input ? `Entrada: ${refLabel(activeSplitter.input)}` : "Entrada (branca)"}
                            style={{ width: 18, height: 18, borderRadius: 999, background: "#fff", border: "2px solid #111" }}
                          />
                          <div style={{ fontSize: 11, fontWeight: 900 }}>IN</div>
                        </div>

                        {/* corpo + linhas internas */}
                        <div style={{ flex: 1, margin: "0 10px", height: 130 }}>
                          <svg width="100%" height="100%" viewBox="0 0 240 130">
                            <rect x="60" y="10" width="120" height="110" rx="14" fill="#fff" stroke="#111" strokeWidth="2" />
                            <text x="120" y="44" textAnchor="middle" fontSize="14" fontWeight="900" fill="#111">
                              {activeSplitter.type}
                            </text>
                            <text x="120" y="68" textAnchor="middle" fontSize="10" fontWeight="800" fill="#666">
                              {activeSplitter.mode === "BALANCED" ? "BALANCED" : "UNBALANCED"}
                            </text>

                            {/* linhas internas (só efeito visual) */}
                            {splitterLegs.map((leg) => {
                              const y = 25 + (leg - 0.5) * (90 / splitterLegs.length)
                              const tgt = getLegTarget(leg)
                              const col = tgt ? refColor(tgt) : "#bbb"
                              return (
                                <path
                                  key={`inside-${leg}`}
                                  d={`M 60 65 C 85 65, 95 ${y}, 180 ${y}`}
                                  fill="none"
                                  stroke={col}
                                  strokeWidth="2"
                                  opacity="0.9"
                                />
                              )
                            })}
                          </svg>
                        </div>

                        {/* pinos OUT (clicáveis) */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                          {splitterLegs.map((leg) => {
                            const tgt = getLegTarget(leg)
                            const col = tgt ? refColor(tgt) : "#fff"
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
                                  background: col,
                                  cursor: "pointer"
                                }}
                                title={tgt ? `OUT ${leg}: ${refLabel(tgt)}` : `OUT ${leg} (vazio)`}
                              />
                            )
                          })}
                          <div style={{ fontSize: 11, fontWeight: 900, marginTop: 4 }}>OUT</div>
                        </div>
                      </div>

                      {/* desbalanceado percent */}
                      {activeSplitter.mode === "UNBALANCED" && (
                        <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
                          <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>Desbalanceado (%)</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {activeSplitter.outputs.map((o) => (
                              <div
                                key={o.leg}
                                style={{ border: "1px solid #eee", borderRadius: 12, padding: "8px 10px", display: "flex", gap: 8, alignItems: "center" }}
                              >
                                <div style={{ fontSize: 12, fontWeight: 900 }}>OUT {o.leg}</div>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={activeSplitter.unbalanced?.[o.leg] ?? 0}
                                  onChange={(e) => onSetSplitterLegUnbalanced(ceo.id, activeSplitter.id, o.leg, Number(e.target.value || 0))}
                                  style={{ width: 70, padding: "6px 8px", borderRadius: 10, border: "1px solid #ddd" }}
                                />
                                <div style={{ fontSize: 12, color: "#666" }}>%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT cable fibers */}
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>
                      Direita • {rightCable ? rightCable.nome : "(sem cabo)"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                      Clique numa fibra para ligar a <b>Perna OUT {activeLeg}</b>.
                    </div>

                    {!activeSplitter.input ? (
                      <div style={{ fontSize: 12, color: "#666", border: "1px dashed #ddd", padding: 10, borderRadius: 12 }}>
                        Defina primeiro a <b>entrada</b> do splitter clicando numa fibra do lado esquerdo.
                      </div>
                    ) : !rightCable ? (
                      <div style={{ fontSize: 12, color: "#666" }}>Selecione uma porta plugada.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {rightCable.fibras.map((f) => {
                          const ref: SplitterRef = { portId: rightPortId, fibraId: f.id }
                          const current = getLegTarget(activeLeg)
                          const active = current?.portId === ref.portId && current?.fibraId === ref.fibraId

                          return (
                            <div
                              key={f.id}
                              data-spl-right={`${rightPortId}:${f.id}`}
                              style={chipStyle(f.cor, active, false)}
                              onClick={() => onSetSplitterOutputRef(ceo.id, activeSplitter.id, activeLeg, ref)}
                              title={`Ligar OUT ${activeLeg} aqui`}
                            >
                              <span style={dotStyle(f.cor)} />
                              <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                              <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                                {active ? `✅ OUT ${activeLeg}` : "—"}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <button
                      onClick={() => onSetSplitterOutputRef(ceo.id, activeSplitter.id, activeLeg, null)}
                      style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
                    >
                      Limpar perna OUT {activeLeg}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                  Cada perna pode ligar em qualquer fibra (mesmo cabo ou outro), desde que a porta esteja plugada na CEO.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LISTA FUSÕES NORMAIS */}
      {tab === "SPLICE" && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Fusões (Splice)</div>

          {ceo.fusoes.length === 0 ? (
            <div style={{ fontSize: 12, color: "#666" }}>
              Selecione uma fibra do IN-1 e depois uma fibra do OUT ativo para criar a fusão.
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
      )}

      {/* INFO: somente cabos plugados */}
      <div style={{ marginTop: 14, fontSize: 12, color: "#666" }}>
        Cabos visíveis aqui: <b>{fibersPlugged.length}</b> (somente os plugados na CEO).
      </div>
    </div>
  )
}