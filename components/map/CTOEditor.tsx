"use client"

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CEO, CEOSplitterMode, CTOConnectorType, CTODropStatus, CTOTerminationType, FiberSegment, SplitterRef } from "@/types/ftth"
import { CableConnectionsSection } from "./cto-editor/CableConnectionsSection"
import { chipStyle, dotStyle, legsFromType } from "./cto-editor/utils"
import { getLegTermination, refKey } from "./cto-editor/physicalModel"

type Props = {
  ceo: CEO
  fibers: FiberSegment[]
  onClose: () => void
  onAddOutPort: (ceoId: number) => void
  onConnectCable: (ceoId: number, portId: string, caboId: number | null) => void
  onFuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onUnfuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onAddCTOPrimarySplitter: (ceoId: number) => void
  onSetSplitterInputRef: (ceoId: number, splitterId: string, ref: SplitterRef | null) => void
  onSetSplitterOutputRef: (ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) => void
  onSetSplitterLegUnbalanced: (ceoId: number, splitterId: string, leg: number, percent: number) => void
  onAddCTOSecondarySplitter: (
    ceoId: number,
    type: "1x8" | "1x16",
    parentLeg: number | null,
    mode?: CEOSplitterMode,
    connectorized?: boolean,
    connectorType?: CTOConnectorType,
    docs?: Partial<{ docName: string; docCode: string; docModel: string; docNotes: string }>
  ) => void
  onRemoveSplitter: (ceoId: number, splitterId: string) => void
  onSetSplitterConfig: (
    ceoId: number,
    splitterId: string,
    patch: Partial<{ connectorized: boolean; connectorType: CTOConnectorType; docName: string; docCode: string; docModel: string; docNotes: string }>
  ) => void
  onSetLegTermination: (ceoId: number, splitterId: string, leg: number, termination: CTOTerminationType) => void
  onSetCableTubeSize: (ceoId: number, cableId: number, tubeSize: 2 | 4 | 6 | 12) => void
  onSetExplicitlyUnfed: (ceoId: number, explicitlyUnfed: boolean) => void
  onAddDrop: (ceoId: number, splitterId: string, leg: number, target: SplitterRef | null, clientName: string) => void
  onUpdateDrop: (
    ceoId: number,
    dropId: string,
    patch: Partial<{ clientName: string; clientCode: string; notes: string; status: CTODropStatus; target: SplitterRef | null }>
  ) => void
  onRemoveDrop: (ceoId: number, dropId: string) => void
}

type Pending =
  | { splitterId: string; leg: number }
  | { splitterId: string; input: true }
  | { cableRef: SplitterRef }
  | null
type UiLine = { key: string; from: { x: number; y: number }; to: { x: number; y: number }; color: string; refs?: string[] }

function getSplitterCfg(ceo: CEO, splitterId: string) {
  return ceo.ctoModel?.splitterConfigs?.find((s) => s.splitterId === splitterId) ?? {
    splitterId,
    connectorized: true,
    connectorType: "APC" as CTOConnectorType,
    docName: "",
    docCode: "",
    docModel: "",
    docNotes: ""
  }
}

export function CTOEditor({
  ceo,
  fibers,
  onClose,
  onAddOutPort,
  onConnectCable,
  onFuse,
  onUnfuse,
  onAddCTOPrimarySplitter,
  onSetSplitterInputRef,
  onSetSplitterOutputRef,
  onSetSplitterLegUnbalanced,
  onAddCTOSecondarySplitter,
  onRemoveSplitter,
  onSetSplitterConfig,
  onSetLegTermination,
  onAddDrop,
  onUpdateDrop,
  onRemoveDrop
}: Props) {
  const [tab, setTab] = useState<"FUSOES_SPLITTERS" | "PORTAS_CLIENTES">("FUSOES_SPLITTERS")
  const [fullscreen, setFullscreen] = useState(false)
  const [leftPortId, setLeftPortId] = useState<string>(() => ceo.ports.find((p) => p.direction === "IN")?.id ?? "IN-1")
  const [rightPortId, setRightPortId] = useState<string>(() => ceo.ports.find((p) => p.direction === "OUT")?.id ?? "OUT-1")
  const [activeSecondaryId, setActiveSecondaryId] = useState<string | null>(null)
  const [activeLeg, setActiveLeg] = useState(1)
  const [pending, setPending] = useState<Pending>(null)
  const [cableToCableMode, setCableToCableMode] = useState(false)
  const [dropClientName, setDropClientName] = useState("")
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [mouseMode, setMouseMode] = useState<"SELECT" | "PAN">("SELECT")
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newType, setNewType] = useState<"1x8" | "1x16">("1x8")
  const [newParentLeg, setNewParentLeg] = useState<number | null>(null)
  const [newMode, setNewMode] = useState<CEOSplitterMode>("BALANCED")
  const [newConnectorized, setNewConnectorized] = useState(true)
  const [newConnectorType, setNewConnectorType] = useState<CTOConnectorType>("APC")
  const [newDocName, setNewDocName] = useState("")
  const [newDocCode, setNewDocCode] = useState("")
  const [newDocModel, setNewDocModel] = useState("")
  const [newDocNotes, setNewDocNotes] = useState("")

  const [lines, setLines] = useState<UiLine[]>([])
  const diagramRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const panStartRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null)

  const portsPlugged = useMemo(() => ceo.ports.filter((p) => p.caboId != null), [ceo.ports])
  const cableByPort = useMemo(() => {
    const map = new Map<string, FiberSegment | null>()
    for (const p of ceo.ports) map.set(p.id, p.caboId ? fibers.find((f) => f.id === p.caboId) ?? null : null)
    return map
  }, [ceo.ports, fibers])
  const leftCable = useMemo(() => cableByPort.get(leftPortId) ?? null, [cableByPort, leftPortId])
  const rightCable = useMemo(() => cableByPort.get(rightPortId) ?? null, [cableByPort, rightPortId])

  const primary = useMemo(() => ceo.splitters.find((s) => s.role === "PRIMARY") ?? null, [ceo.splitters])
  const secondaries = useMemo(() => ceo.splitters.filter((s) => s.role === "SECONDARY"), [ceo.splitters])
  const activeSecondary = useMemo(() => secondaries.find((s) => s.id === activeSecondaryId) ?? secondaries[0] ?? null, [secondaries, activeSecondaryId])

  const used = useMemo(() => {
    const s = new Set<string>()
    for (const f of ceo.fusoes) {
      s.add(`${f.a.portId}::${f.a.fibraId}`)
      s.add(`${f.b.portId}::${f.b.fibraId}`)
    }
    for (const spl of ceo.splitters) {
      if (spl.input) s.add(refKey(spl.input))
      for (const o of spl.outputs) if (o.target) s.add(refKey(o.target))
    }
    return s
  }, [ceo.fusoes, ceo.splitters])

  const sortedSecondaries = useMemo(() => {
    const arr = [...secondaries]
    arr.sort((a, b) => {
      const aCfg = getSplitterCfg(ceo, a.id)
      const bCfg = getSplitterCfg(ceo, b.id)
      if (aCfg.connectorized === bCfg.connectorized) return a.id.localeCompare(b.id)
      return aCfg.connectorized ? 1 : -1
    })
    return arr
  }, [secondaries, ceo])

  useLayoutEffect(() => {
    const el = diagramRef.current
    const panel = panelRef.current
    if (!el || !panel) return
    let raf = 0
    const calc = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const base = el.getBoundingClientRect()
        const next: UiLine[] = []
        for (const s of secondaries) {
          if (s.input) {
            const fiberEl = el.querySelector<HTMLElement>(`[data-fiber="${s.input.portId}:${s.input.fibraId}"]`)
            const pinEl = el.querySelector<HTMLElement>(`[data-spl-in="${s.id}"]`)
            if (fiberEl && pinEl) {
              const a = fiberEl.getBoundingClientRect()
              const b = pinEl.getBoundingClientRect()
              next.push({
                key: `in-${s.id}`,
                from: { x: a.right - base.left, y: a.top - base.top + a.height / 2 },
                to: { x: b.left - base.left, y: b.top - base.top + b.height / 2 },
                color: "#2f54eb",
                refs: [refKey(s.input), `spl-in:${s.id}`]
              })
            }
          }
          for (const o of s.outputs) {
            if (!o.target) continue
            const pinEl = el.querySelector<HTMLElement>(`[data-spl-leg="${s.id}:${o.leg}"]`)
            const fiberEl = el.querySelector<HTMLElement>(`[data-fiber="${o.target.portId}:${o.target.fibraId}"]`)
            if (pinEl && fiberEl) {
              const a = pinEl.getBoundingClientRect()
              const b = fiberEl.getBoundingClientRect()
              next.push({
                key: `out-${s.id}-${o.leg}`,
                from: { x: a.right - base.left, y: a.top - base.top + a.height / 2 },
                to: { x: b.left - base.left, y: b.top - base.top + b.height / 2 },
                color: "#13c2c2",
                refs: [refKey(o.target), `spl-leg:${s.id}:${o.leg}`]
              })
            }
          }
        }
        for (let i = 0; i < ceo.fusoes.length; i++) {
          const f = ceo.fusoes[i]
          const aEl = el.querySelector<HTMLElement>(`[data-fiber="${f.a.portId}:${f.a.fibraId}"]`)
          const bEl = el.querySelector<HTMLElement>(`[data-fiber="${f.b.portId}:${f.b.fibraId}"]`)
          if (!aEl || !bEl) continue
          const a = aEl.getBoundingClientRect()
          const b = bEl.getBoundingClientRect()
          next.push({
            key: `fuse-${i}-${f.a.portId}-${f.a.fibraId}-${f.b.portId}-${f.b.fibraId}`,
            from: { x: a.right - base.left, y: a.top - base.top + a.height / 2 },
            to: { x: b.left - base.left, y: b.top - base.top + b.height / 2 },
            color: "#fa8c16",
            refs: [refKey(f.a), refKey(f.b)]
          })
        }
        setLines(next)
      })
    }
    calc()
    const onScroll = () => calc()
    panel.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", calc)
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      panel.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", calc)
      ro.disconnect()
    }
  }, [secondaries, ceo])

  useEffect(() => {
    const up = () => {
      panStartRef.current = null
      setIsPanning(false)
    }
    window.addEventListener("mouseup", up)
    return () => window.removeEventListener("mouseup", up)
  }, [])

  function clampZoom(next: number) {
    return Math.min(2.2, Math.max(0.75, next))
  }

  function handleDiagramWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.07 : 0.93
    setZoom((z) => clampZoom(z * factor))
  }

  function startPanning(e: React.MouseEvent<HTMLDivElement>) {
    if (mouseMode !== "PAN" || e.button !== 0) return
    e.preventDefault()
    panStartRef.current = { x: e.clientX, y: e.clientY, baseX: pan.x, baseY: pan.y }
    setIsPanning(true)
  }

  function movePanning(e: React.MouseEvent<HTMLDivElement>) {
    if (!panStartRef.current) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setPan({ x: panStartRef.current.baseX + dx, y: panStartRef.current.baseY + dy })
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  function handleFiberClick(portId: string, fibraId: number) {
    const ref: SplitterRef = { portId, fibraId }
    if (!pending) return
    if ("cableRef" in pending) {
      if (pending.cableRef.portId === portId && pending.cableRef.fibraId === fibraId) {
        setPending(null)
        return
      }
      const kA = refKey(pending.cableRef)
      const kB = refKey(ref)
      if (used.has(kA) || used.has(kB)) {
        setPending(null)
        setCableToCableMode(false)
        return
      }
      onFuse(ceo.id, pending.cableRef.portId, pending.cableRef.fibraId, portId, fibraId)
      setPending(null)
      setCableToCableMode(false)
      return
    }
    if ("input" in pending) {
      const s = ceo.splitters.find((x) => x.id === pending.splitterId)
      const active = s?.input?.portId === portId && s?.input?.fibraId === fibraId
      const busy = used.has(refKey(ref)) && !active
      if (!busy) onSetSplitterInputRef(ceo.id, pending.splitterId, ref)
      setPending(null)
      return
    }
    const s = ceo.splitters.find((x) => x.id === pending.splitterId)
    const current = s?.outputs.find((o) => o.leg === pending.leg)?.target
    const active = current?.portId === portId && current?.fibraId === fibraId
    const busy = used.has(refKey(ref)) && !active
    if (!busy) onSetSplitterOutputRef(ceo.id, pending.splitterId, pending.leg, ref)
    setPending(null)
  }

  function startCableToCableFrom(ref: SplitterRef) {
    if (!cableToCableMode) return
    if (used.has(refKey(ref))) return
    setPending({ cableRef: ref })
  }

  function openAddDialog() {
    setDialogOpen(true)
    setNewType("1x8")
    setNewParentLeg(null)
    setNewMode("BALANCED")
    setNewConnectorized(true)
    setNewConnectorType("APC")
    setNewDocName("")
    setNewDocCode("")
    setNewDocModel("")
    setNewDocNotes("")
  }

  function confirmAddSplitter() {
    onAddCTOSecondarySplitter(ceo.id, newType, newParentLeg, newMode, newConnectorized, newConnectorType, {
      docName: newDocName,
      docCode: newDocCode,
      docModel: newDocModel,
      docNotes: newDocNotes
    })
    setDialogOpen(false)
  }

  const splittersForPorts = useMemo(() => secondaries.filter((s) => {
    const cfg = getSplitterCfg(ceo, s.id)
    return s.mode === "BALANCED" && cfg.connectorized
  }), [secondaries, ceo])

  const panelStyle: React.CSSProperties = fullscreen
    ? {
        position: "fixed",
        inset: 12,
        zIndex: 1500,
        background: "linear-gradient(145deg, #f7fafc 0%, #ffffff 38%, #eef4ff 100%)",
        border: "1px solid #dce4f0",
        borderRadius: 14,
        boxShadow: "0 16px 44px rgba(8, 20, 43, 0.28)",
        overflow: "auto",
        padding: 14,
        backdropFilter: "blur(6px)"
      }
    : {
        position: "absolute",
        top: 20,
        right: 20,
        zIndex: 1000,
        width: 1180,
        maxHeight: "90vh",
        overflow: "auto",
        background: "linear-gradient(160deg, #f9fbff 0%, #ffffff 52%, #eef5ff 100%)",
        borderRadius: 14,
        border: "1px solid #dce4f0",
        boxShadow: "0 14px 36px rgba(8, 20, 43, 0.2)",
        padding: 14,
        backdropFilter: "blur(6px)"
      }

  return (
    <div ref={panelRef} style={panelStyle}>
      <style>{`
        .cto-line-glow {
          filter: blur(2px);
          opacity: .45;
        }
        .cto-line-main {
          stroke-dasharray: 8 7;
          animation: ctoFlow 1.6s linear infinite;
        }
        @keyframes ctoFlow {
          to { stroke-dashoffset: -30; }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{ceo.nome} (CTO)</div>
          <div style={{ fontSize: 12, color: "#555" }}>{ceo.descricao}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={() => setTab("FUSOES_SPLITTERS")} style={{ border: "1px solid #cfd8e6", background: tab === "FUSOES_SPLITTERS" ? "#102a56" : "#fff", color: tab === "FUSOES_SPLITTERS" ? "#fff" : "#111", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontWeight: 900, transition: "all .2s ease" }}>Aba 1: Fusoes e Splitters</button>
            <button onClick={() => setTab("PORTAS_CLIENTES")} style={{ border: "1px solid #cfd8e6", background: tab === "PORTAS_CLIENTES" ? "#102a56" : "#fff", color: tab === "PORTAS_CLIENTES" ? "#fff" : "#111", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontWeight: 900, transition: "all .2s ease" }}>Aba 2: Portas e Clientes</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setFullscreen((v) => !v)} style={{ border: "1px solid #cfd8e6", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>{fullscreen ? "Sair tela cheia" : "Tela cheia"}</button>
          <button onClick={onClose} style={{ border: "1px solid #cfd8e6", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>Fechar</button>
        </div>
      </div>

      <CableConnectionsSection
        ceoId={ceo.id}
        inPort={ceo.ports.find((p) => p.id === "IN-1") ?? null}
        outPorts={ceo.ports.filter((p) => p.direction === "OUT")}
        activeOutPortId={rightPortId}
        fibers={fibers}
        onAddOutPort={onAddOutPort}
        onConnectCable={onConnectCable}
        onSetActiveOutPortId={setRightPortId}
      />

      {tab === "FUSOES_SPLITTERS" && (
        <div
          ref={diagramRef}
          onWheel={handleDiagramWheel}
          onMouseDown={startPanning}
          onMouseMove={movePanning}
          style={{
            marginTop: 12,
            position: "relative",
            border: "1px solid #dbe5f3",
            borderRadius: 12,
            padding: 12,
            background:
              "radial-gradient(circle at 15% 14%, rgba(146,191,255,.18) 0%, rgba(146,191,255,0) 32%), radial-gradient(circle at 85% 80%, rgba(19,194,194,.12) 0%, rgba(19,194,194,0) 34%), #fbfdff",
            overflow: "hidden",
            cursor: mouseMode === "PAN" ? (isPanning ? "grabbing" : "grab") : "default"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setMouseMode("SELECT")} style={{ border: "1px solid #cfd8e6", borderRadius: 8, background: mouseMode === "SELECT" ? "#102a56" : "#fff", color: mouseMode === "SELECT" ? "#fff" : "#1f2937", padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>Mouse: selecao</button>
              <button onClick={() => setMouseMode("PAN")} style={{ border: "1px solid #cfd8e6", borderRadius: 8, background: mouseMode === "PAN" ? "#102a56" : "#fff", color: mouseMode === "PAN" ? "#fff" : "#1f2937", padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>Mouse: arrastar</button>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setZoom((v) => clampZoom(v * 0.9))} style={{ border: "1px solid #cfd8e6", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "4px 8px", fontWeight: 700 }}>-</button>
              <div style={{ fontSize: 12, minWidth: 56, textAlign: "center", color: "#374151" }}>{Math.round(zoom * 100)}%</div>
              <button onClick={() => setZoom((v) => clampZoom(v * 1.1))} style={{ border: "1px solid #cfd8e6", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "4px 8px", fontWeight: 700 }}>+</button>
              <button onClick={resetView} style={{ border: "1px solid #cfd8e6", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "4px 8px", fontSize: 12 }}>Reset vista</button>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "top left",
              transition: isPanning ? "none" : "transform .16s ease-out"
            }}
          >
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
              {lines.map((l) => {
                const mid = (l.to.x - l.from.x) * 0.35
                const d = `M ${l.from.x} ${l.from.y} C ${l.from.x + mid} ${l.from.y}, ${l.to.x - mid} ${l.to.y}, ${l.to.x} ${l.to.y}`
                const highlighted = hoverKey ? Boolean(l.refs?.includes(hoverKey)) : false
                const faded = hoverKey ? !highlighted : false
                return (
                  <g key={l.key}>
                    <path d={d} fill="none" stroke={l.color} strokeWidth={8} className="cto-line-glow" strokeLinecap="round" opacity={faded ? 0.08 : highlighted ? 0.9 : 0.35} />
                    <path d={d} fill="none" stroke={l.color} strokeWidth={highlighted ? 4.3 : 3} className="cto-line-main" strokeLinecap="round" opacity={faded ? 0.22 : 0.95} />
                  </g>
                )
              })}
            </svg>

            <div style={{ position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Cabo esquerdo (entrada/fonte)</div>
              <div style={{ marginBottom: 8, display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    setCableToCableMode((v) => !v)
                    setPending(null)
                  }}
                  style={{ border: "1px solid #ddd", borderRadius: 8, background: cableToCableMode ? "#111" : "#fff", color: cableToCableMode ? "#fff" : "#111", cursor: "pointer", padding: "4px 8px", fontSize: 12 }}
                >
                  Modo fusao cabo-cabo
                </button>
              </div>
              <select value={leftPortId} onChange={(e) => setLeftPortId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", marginBottom: 8 }}>
                {portsPlugged.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.id})</option>)}
              </select>
              {!leftCable ? <div style={{ fontSize: 12, color: "#666" }}>Sem cabo.</div> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6 }}>
                  {leftCable.fibras.map((f) => {
                    const ref: SplitterRef = { portId: leftPortId, fibraId: f.id }
                    const busy = used.has(refKey(ref))
                    const activeCablePick = Boolean(pending && "cableRef" in pending && pending.cableRef.portId === leftPortId && pending.cableRef.fibraId === f.id)
                    return (
                      <div
                        key={f.id}
                        data-fiber={`${leftPortId}:${f.id}`}
                        style={{
                          ...chipStyle(activeCablePick, busy && pending == null),
                          border: hoverKey === `${leftPortId}::${f.id}` ? "1px solid #2f54eb" : activeCablePick ? "2px solid #102a56" : "1px solid #d7e0ef",
                          boxShadow: hoverKey === `${leftPortId}::${f.id}` ? "0 6px 14px rgba(47,84,235,.23)" : "0 1px 1px rgba(0,0,0,.03)",
                          transform: hoverKey === `${leftPortId}::${f.id}` ? "translateY(-1px)" : "none",
                          transition: "all .14s ease"
                        }}
                        onMouseEnter={() => setHoverKey(`${leftPortId}::${f.id}`)}
                        onMouseLeave={() => setHoverKey((v) => (v === `${leftPortId}::${f.id}` ? null : v))}
                        onClick={() => {
                          if (mouseMode === "PAN") return
                          if (cableToCableMode && !pending) startCableToCableFrom(ref)
                          else handleFiberClick(leftPortId, f.id)
                        }}
                        title={`${leftPortId} / Fibra ${f.id}`}
                      >
                        <span style={dotStyle(f.cor)} />F{f.id}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 900 }}>Splitters desenhados</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!primary && <button onClick={() => onAddCTOPrimarySplitter(ceo.id)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>+ Primario</button>}
                  <button onClick={openAddDialog} style={{ border: "1px solid #ddd", background: "#111", color: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>+ Add Splitter</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {sortedSecondaries.map((s) => {
                  const cfg = getSplitterCfg(ceo, s.id)
                  const legs = legsFromType(s.type)
                  const legOnCard = activeSecondary?.id === s.id ? activeLeg : 1
                  const termOnCard = getLegTermination(ceo.ctoModel, s.id, legOnCard)
                  const targetOnCard = s.outputs.find((o) => o.leg === legOnCard)?.target
                  return (
                    <div key={s.id} style={{ width: 300, border: activeSecondary?.id === s.id ? "1px solid #9bb4df" : "1px solid #d8e1ef", borderRadius: 12, padding: 8, background: activeSecondary?.id === s.id ? "linear-gradient(160deg,#f6f9ff 0%, #ffffff 70%)" : "#fff", boxShadow: activeSecondary?.id === s.id ? "0 10px 22px rgba(16,42,86,.14)" : "0 4px 10px rgba(16,42,86,.05)", transition: "all .16s ease" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <button onClick={() => setActiveSecondaryId(s.id)} style={{ border: "1px solid #cfd8e6", borderRadius: 8, background: activeSecondary?.id === s.id ? "#102a56" : "#fff", color: activeSecondary?.id === s.id ? "#fff" : "#111", padding: "4px 8px", fontWeight: 900, cursor: "pointer" }}>
                          {s.type} {cfg.connectorized ? `[${cfg.connectorType}]` : "[FUSIVEL]"}
                        </button>
                        <button onClick={() => onRemoveSplitter(ceo.id, s.id)} style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Remover</button>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: "#666" }}>
                        Doc: {cfg.docName || "-"} | Cod: {cfg.docCode || "-"} | Mod: {cfg.docModel || "-"}
                      </div>
                      <div style={{ marginTop: 6, border: "1px solid #eee", borderRadius: 8, padding: 6 }}>
                        <svg width="100%" height="150" viewBox="0 0 280 150">
                          <defs>
                            <linearGradient id={`spl-body-${s.id}`} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#f9fbff" />
                              <stop offset="100%" stopColor="#e8eefc" />
                            </linearGradient>
                          </defs>
                          <rect x="98" y="20" width="84" height="110" rx="10" fill={`url(#spl-body-${s.id})`} stroke="#102a56" strokeWidth="2" />
                          <text x="140" y="44" textAnchor="middle" fontSize="12" fontWeight="700">{s.type}</text>
                          <text x="140" y="58" textAnchor="middle" fontSize="9" fill="#666">{s.mode}</text>
                          <text x="140" y="71" textAnchor="middle" fontSize="8" fill="#888">{cfg.connectorized ? `CON ${cfg.connectorType}` : "FIBRA NUA"}</text>

                          <line x1="82" y1="75" x2="98" y2="75" stroke="#111" strokeWidth="2" />
                          <circle
                            cx="82"
                            cy="75"
                            r="6"
                            data-spl-in={s.id}
                            onMouseEnter={() => setHoverKey(`spl-in:${s.id}`)}
                            onMouseLeave={() => setHoverKey((v) => (v === `spl-in:${s.id}` ? null : v))}
                            onClick={() => {
                              if (mouseMode === "PAN") return
                              setPending({ splitterId: s.id, input: true })
                            }}
                            fill={pending && "input" in pending && pending.splitterId === s.id ? "#111" : "#fff"}
                            stroke={hoverKey === `spl-in:${s.id}` ? "#2f54eb" : "#111"}
                            strokeWidth="2"
                            style={{ cursor: mouseMode === "PAN" ? "default" : "pointer" }}
                          />

                          {legs.slice(0, 16).map((leg, idx) => {
                            const y = 27 + idx * (100 / Math.max(legs.length - 1, 1))
                            const term = getLegTermination(ceo.ctoModel, s.id, leg)
                            const tgt = s.outputs.find((o) => o.leg === leg)?.target
                            const active = Boolean(
                              pending &&
                              !("input" in pending) &&
                              "splitterId" in pending &&
                              pending.splitterId === s.id &&
                              pending.leg === leg
                            )
                            const color = term === "CONECTOR" ? "#999" : active ? "#111" : "#fff"
                            return (
                              <g key={leg}>
                                <line x1="182" y1={y} x2="197" y2={y} stroke="#111" strokeWidth="1.5" />
                                <circle
                                  cx="203"
                                  cy={y}
                                  r="5.3"
                                  data-spl-leg={`${s.id}:${leg}`}
                                  onMouseEnter={() => setHoverKey(`spl-leg:${s.id}:${leg}`)}
                                  onMouseLeave={() => setHoverKey((v) => (v === `spl-leg:${s.id}:${leg}` ? null : v))}
                                  onClick={() => {
                                    if (mouseMode === "PAN") return
                                    setActiveSecondaryId(s.id)
                                    setActiveLeg(leg)
                                    if (term === "FIBRA_NUA") setPending({ splitterId: s.id, leg })
                                  }}
                                  fill={color}
                                  stroke={hoverKey === `spl-leg:${s.id}:${leg}` ? "#13c2c2" : "#111"}
                                  strokeWidth="1.5"
                                  style={{ cursor: term === "FIBRA_NUA" && mouseMode !== "PAN" ? "pointer" : "default" }}
                                />
                                {legs.length <= 8 && <text x="214" y={y + 3} fontSize="8" fill="#666">L{leg}</text>}
                                {tgt && <circle cx="194" cy={y} r="2" fill="#13c2c2" />}
                              </g>
                            )
                          })}
                        </svg>
                      </div>
                      <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                        <button onClick={() => onSetSplitterInputRef(ceo.id, s.id, null)} style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "4px 8px" }}>Limpar IN</button>
                        <button onClick={() => onSetSplitterConfig(ceo.id, s.id, { connectorized: !cfg.connectorized })} style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "4px 8px" }}>{cfg.connectorized ? "Cortar base" : "Conectorizar"}</button>
                      </div>
                      <div style={{ marginTop: 6, borderTop: "1px solid #eee", paddingTop: 6 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <select
                            value={legOnCard}
                            onChange={(e) => {
                              setActiveSecondaryId(s.id)
                              setActiveLeg(Number(e.target.value))
                            }}
                            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "4px 6px" }}
                          >
                            {legs.map((leg) => <option key={leg} value={leg}>OUT {leg}</option>)}
                          </select>
                          <button
                            onClick={() => {
                              setActiveSecondaryId(s.id)
                              if (termOnCard === "FIBRA_NUA") setPending({ splitterId: s.id, leg: legOnCard })
                            }}
                            style={{ border: "1px solid #ddd", borderRadius: 8, background: termOnCard === "FIBRA_NUA" ? "#fff" : "#fafafa", cursor: termOnCard === "FIBRA_NUA" ? "pointer" : "not-allowed", padding: "4px 8px", fontSize: 11 }}
                          >
                            {termOnCard === "FIBRA_NUA" ? "Fusionar OUT ativo" : `CON ${cfg.connectorType}`}
                          </button>
                        </div>
                        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={() => {
                              const next = termOnCard === "CONECTOR" ? "FIBRA_NUA" : "CONECTOR"
                              onSetLegTermination(ceo.id, s.id, legOnCard, next)
                              if (next === "CONECTOR") onSetSplitterOutputRef(ceo.id, s.id, legOnCard, null)
                            }}
                            style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "4px 8px", fontSize: 11 }}
                          >
                            {termOnCard === "CONECTOR" ? "Cortar conector da OUT ativa" : "Repor conector na OUT ativa"}
                          </button>
                          <div style={{ fontSize: 10, color: "#666" }}>{targetOnCard ? `${targetOnCard.portId} F${targetOnCard.fibraId}` : "-"}</div>
                        </div>
                      </div>
                      {s.mode === "UNBALANCED" && (
                        <div style={{ marginTop: 6, borderTop: "1px solid #eee", paddingTop: 6, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 4 }}>
                          {s.outputs.map((o) => (
                            <label key={o.leg} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
                              {o.leg}
                              <input type="number" min={0} max={100} value={s.unbalanced?.[o.leg] ?? 0} onChange={(e) => onSetSplitterLegUnbalanced(ceo.id, s.id, o.leg, Number(e.target.value || 0))} style={{ width: 50, border: "1px solid #ddd", borderRadius: 6, padding: "2px 4px" }} />
                              %
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {pending && <div style={{ marginTop: 8, fontSize: 12, color: "#a8071a" }}>
                {"cableRef" in pending
                  ? `Fusao cabo-cabo ativa: origem ${pending.cableRef.portId} F${pending.cableRef.fibraId}. Clique no destino.`
                  : "Modo mouse ativo: clique em uma fibra para concluir a ligação."}
              </div>}
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Cabo de saida (direita)</div>
              <select value={rightPortId} onChange={(e) => setRightPortId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", marginBottom: 8 }}>
                {portsPlugged.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.id})</option>)}
              </select>
              {!rightCable ? <div style={{ fontSize: 12, color: "#666" }}>Sem cabo.</div> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6 }}>
                  {rightCable.fibras.map((f) => {
                    const ref: SplitterRef = { portId: rightPortId, fibraId: f.id }
                    const busy = used.has(refKey(ref))
                    const activeCablePick = Boolean(pending && "cableRef" in pending && pending.cableRef.portId === rightPortId && pending.cableRef.fibraId === f.id)
                    return (
                      <div
                        key={f.id}
                        data-fiber={`${rightPortId}:${f.id}`}
                        style={{
                          ...chipStyle(activeCablePick, busy && pending == null),
                          border: hoverKey === `${rightPortId}::${f.id}` ? "1px solid #13c2c2" : activeCablePick ? "2px solid #102a56" : "1px solid #d7e0ef",
                          boxShadow: hoverKey === `${rightPortId}::${f.id}` ? "0 6px 14px rgba(19,194,194,.25)" : "0 1px 1px rgba(0,0,0,.03)",
                          transform: hoverKey === `${rightPortId}::${f.id}` ? "translateY(-1px)" : "none",
                          transition: "all .14s ease"
                        }}
                        onMouseEnter={() => setHoverKey(`${rightPortId}::${f.id}`)}
                        onMouseLeave={() => setHoverKey((v) => (v === `${rightPortId}::${f.id}` ? null : v))}
                        onClick={() => {
                          if (mouseMode === "PAN") return
                          if (cableToCableMode && !pending) startCableToCableFrom(ref)
                          else handleFiberClick(rightPortId, f.id)
                        }}
                        title={`${rightPortId} / Fibra ${f.id}`}
                      >
                        <span style={dotStyle(f.cor)} />F{f.id}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          </div>

          <div style={{ marginTop: 10, border: "1px solid #d8e1ef", borderRadius: 12, padding: 10, background: "#fff" }}>
            <div style={{ marginBottom: 8, fontSize: 12, color: "#475569", border: "1px dashed #cdd8ea", borderRadius: 8, padding: "6px 8px", background: "#f8fbff" }}>
              Mouse: use roda para zoom, troque para &quot;arrastar&quot; para navegar no diagrama, e passe o mouse nos pontos/fibras para destacar o caminho optico.
            </div>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Fusoes existentes (porta-fibra)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ceo.fusoes.length === 0 ? <div style={{ fontSize: 12, color: "#666" }}>Nenhuma fusao.</div> : ceo.fusoes.map((f, i) => (
                <div key={`${i}-${f.a.portId}-${f.a.fibraId}-${f.b.portId}-${f.b.fibraId}`} style={{ display: "flex", justifyContent: "space-between", border: "1px solid #eee", borderRadius: 8, padding: 6 }}>
                  <div style={{ fontSize: 12 }}>{f.a.portId}:F{f.a.fibraId} {"<->"} {f.b.portId}:F{f.b.fibraId}</div>
                  <button onClick={() => onUnfuse(ceo.id, f.a.portId, f.a.fibraId, f.b.portId, f.b.fibraId)} style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Desfazer</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "PORTAS_CLIENTES" && (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Portas de atendimento (somente balanceado + conectorizado)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {splittersForPorts.map((s) => (
                <button key={s.id} onClick={() => setActiveSecondaryId(s.id)} style={{ border: "1px solid #ddd", background: s.id === activeSecondary?.id ? "#111" : "#fff", color: s.id === activeSecondary?.id ? "#fff" : "#111", borderRadius: 999, padding: "6px 10px", cursor: "pointer", fontWeight: 900 }}>
                  {s.type} ({getSplitterCfg(ceo, s.id).connectorType})
                </button>
              ))}
            </div>
            {!activeSecondary ? <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>Selecione um splitter elegivel.</div> : (
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
                {legsFromType(activeSecondary.type).map((leg) => (
                  <button key={leg} onClick={() => setActiveLeg(leg)} style={{ border: activeLeg === leg ? "2px solid #111" : "1px solid #ddd", borderRadius: 10, background: "#fff", padding: 8, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>OUT {leg}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>{activeSecondary.outputs.find((o) => o.leg === leg)?.target ? "Ligada" : "Livre"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Clientes cadastrados</div>
            {!activeSecondary ? <div style={{ fontSize: 12, color: "#666" }}>Selecione um splitter.</div> : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
                <input value={dropClientName} onChange={(e) => setDropClientName(e.target.value)} placeholder="Nome do cliente" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }} />
                <button onClick={() => onAddDrop(ceo.id, activeSecondary.id, activeLeg, activeSecondary.outputs.find((o) => o.leg === activeLeg)?.target ?? null, dropClientName)} style={{ border: "1px solid #ddd", background: "#111", color: "#fff", borderRadius: 10, cursor: "pointer" }}>
                  + Cliente
                </button>
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {ceo.ctoModel?.drops?.length ? ceo.ctoModel.drops.map((d) => (
                <div key={d.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 8, alignItems: "center" }}>
                    <input value={d.clientName} onChange={(e) => onUpdateDrop(ceo.id, d.id, { clientName: e.target.value })} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }} />
                    <select value={d.status} onChange={(e) => onUpdateDrop(ceo.id, d.id, { status: e.target.value as CTODropStatus })} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}>
                      <option value="PLANEJADO">Planejado</option>
                      <option value="INSTALADO">Instalado</option>
                      <option value="ATIVO">Ativo</option>
                      <option value="MANUTENCAO">Manutencao</option>
                    </select>
                    <button onClick={() => onRemoveDrop(ceo.id, d.id)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 8, cursor: "pointer" }}>Remover</button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>{d.splitterId} | OUT {d.leg} | alvo: {d.target ? `${d.target.portId} F${d.target.fibraId}` : "nao definido"}</div>
                </div>
              )) : <div style={{ fontSize: 12, color: "#666" }}>Nenhum cliente cadastrado.</div>}
            </div>
          </div>
        </div>
      )}

      {dialogOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", zIndex: 2000 }}>
          <div style={{ width: 560, background: "#fff", borderRadius: 12, border: "1px solid #ddd", padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Cadastro do splitter</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="Nome/Tag do splitter" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }} />
              <input value={newDocCode} onChange={(e) => setNewDocCode(e.target.value)} placeholder="Codigo/Serie" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }} />
              <input value={newDocModel} onChange={(e) => setNewDocModel(e.target.value)} placeholder="Modelo/Fabricante" style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }} />
              <select value={newType} onChange={(e) => setNewType(e.target.value as "1x8" | "1x16")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
                <option value="1x8">1x8</option>
                <option value="1x16">1x16</option>
              </select>
              <select value={newMode} onChange={(e) => setNewMode(e.target.value as CEOSplitterMode)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
                <option value="BALANCED">Balanceado</option>
                <option value="UNBALANCED">Desbalanceado</option>
              </select>
              <select value={newParentLeg == null ? "" : String(newParentLeg)} onChange={(e) => setNewParentLeg(e.target.value ? Number(e.target.value) : null)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
                <option value="">Entrada por fusao</option>
                {Array.from({ length: 8 }, (_, i) => i + 1)
                  .filter((leg) => !secondaries.some((s) => s.parentLeg === leg))
                  .map((leg) => <option key={leg} value={leg}>Perna primario {leg}</option>)}
              </select>
            </div>
            <textarea value={newDocNotes} onChange={(e) => setNewDocNotes(e.target.value)} placeholder="Observacoes tecnicas / documentacao" style={{ marginTop: 8, width: "100%", minHeight: 70, border: "1px solid #ddd", borderRadius: 8, padding: 8 }} />
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={newConnectorized} onChange={(e) => setNewConnectorized(e.target.checked)} />
                Conectorizado
              </label>
              <select value={newConnectorType} onChange={(e) => setNewConnectorType(e.target.value as CTOConnectorType)} disabled={!newConnectorized} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}>
                <option value="APC">APC</option>
                <option value="UPC">UPC</option>
              </select>
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "end", gap: 8 }}>
              <button onClick={() => setDialogOpen(false)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmAddSplitter} style={{ border: "1px solid #ddd", background: "#111", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>Adicionar splitter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

