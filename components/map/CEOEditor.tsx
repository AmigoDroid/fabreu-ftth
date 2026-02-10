"use client"

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  CEO,
  FiberSegment,
  CEOSplitterMode,
  CEOSplitterType,
  SplitterRef
} from "@/types/ftth"
import { CEOEditorHeader } from "./ceo-editor/CEOEditorHeader"
import { CableConnectionsSection } from "./ceo-editor/CableConnectionsSection"
import { FusionListSection } from "./ceo-editor/FusionListSection"
import { SpliceTab } from "./ceo-editor/SpliceTab"
import { SplitterTab } from "./ceo-editor/SplitterTab"
import { DiagramLine, legsFromType } from "./ceo-editor/utils"

type Props = {
  ceo: CEO
  fibers: FiberSegment[]
  onClose: () => void
  onAddOutPort: (ceoId: number) => void
  onConnectCable: (ceoId: number, portId: string, caboId: number | null) => void
  onFuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onUnfuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onAddSplitter: (ceoId: number, type: CEOSplitterType, mode: CEOSplitterMode) => void
  onRemoveSplitter: (ceoId: number, splitterId: string) => void
  onSetSplitterInputRef: (ceoId: number, splitterId: string, ref: SplitterRef | null) => void
  onSetSplitterOutputRef: (ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) => void
  onSetSplitterLegUnbalanced: (ceoId: number, splitterId: string, leg: number, percent: number) => void
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
  const outPorts = useMemo(() => ceo.ports.filter((p) => p.direction === "OUT"), [ceo.ports])
  const inPort = useMemo(() => ceo.ports.find((p) => p.id === "IN-1") ?? null, [ceo.ports])

  const [activeOutPortId, setActiveOutPortId] = useState<string>(() => outPorts[0]?.id ?? "OUT-1")
  const [tab, setTab] = useState<"SPLICE" | "SPLITTER">("SPLICE")

  useMemo(() => {
    if (!outPorts.some((p) => p.id === activeOutPortId)) setActiveOutPortId(outPorts[0]?.id ?? "OUT-1")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outPorts.map((p) => p.id).join("|")])

  const activeOutPort = outPorts.find((p) => p.id === activeOutPortId) ?? null
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

  const [selA, setSelA] = useState<number | null>(null)
  const [selB, setSelB] = useState<number | null>(null)

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

  const getColorIN = useCallback((fibraId: number) => {
    return caboIN?.fibras.find((x) => x.id === fibraId)?.cor ?? "#111"
  }, [caboIN?.fibras])

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

  const onSelectIn = (fibraId: number) => {
    if (usedIN.has(fibraId)) return
    const next = selA === fibraId ? null : fibraId
    setSelA(next)
    tryFuse(next, selB)
  }

  const onSelectOut = (fibraId: number) => {
    if (usedOUTActive.has(fibraId)) return
    const next = selB === fibraId ? null : fibraId
    setSelB(next)
    tryFuse(selA, next)
  }

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

  const refColor = useCallback((ref: SplitterRef | null) => {
    if (!ref) return "#777"
    const cabo = cableByPortId.get(ref.portId)
    const cor = cabo?.fibras.find((x) => x.id === ref.fibraId)?.cor
    return cor ?? "#777"
  }, [cableByPortId])

  const getLegTarget = useCallback((leg: number) => {
    if (!activeSplitter) return null
    return activeSplitter.outputs.find((o) => o.leg === leg)?.target ?? null
  }, [activeSplitter])

  const panelRef = useRef<HTMLDivElement | null>(null)
  const diagramRef = useRef<HTMLDivElement | null>(null)
  const [lines, setLines] = useState<DiagramLine[]>([])

  useLayoutEffect(() => {
    const panelEl = panelRef.current
    const diagramEl = diagramRef.current
    if (!panelEl || !diagramEl) return

    let raf = 0
    const calc = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const baseRect = diagramEl.getBoundingClientRect()
        const next: DiagramLine[] = []

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

        if (tab === "SPLITTER" && activeSplitter) {
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
      panelEl.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", calc)
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
    leftPortId,
    rightPortId,
    activeSplitter,
    getLegTarget,
    getColorIN,
    refColor
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
      <CEOEditorHeader
        ceoName={ceo.nome}
        ceoDescription={ceo.descricao}
        tab={tab}
        onTabChange={setTab}
        onClose={onClose}
      />

      <CableConnectionsSection
        ceoId={ceo.id}
        inPort={inPort}
        outPorts={outPorts}
        activeOutPortId={activeOutPortId}
        fibers={fibers}
        onAddOutPort={onAddOutPort}
        onConnectCable={onConnectCable}
        onSetActiveOutPortId={setActiveOutPortId}
      />

      <div ref={diagramRef} style={{ position: "relative", marginTop: 12 }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }}>
          {lines.map((ln) => {
            const mid = (ln.b.x - ln.a.x) * 0.35
            const c1x = ln.a.x + mid
            const c2x = ln.b.x - mid
            const d = `M ${ln.a.x} ${ln.a.y} C ${c1x} ${ln.a.y}, ${c2x} ${ln.b.y}, ${ln.b.x} ${ln.b.y}`
            return <path key={ln.key} d={d} fill="none" stroke={ln.color} strokeWidth={3} strokeLinecap="round" opacity={0.92} />
          })}
        </svg>

        {tab === "SPLICE" && (
          <SpliceTab
            caboIN={caboIN}
            caboOUT={caboOUT}
            activeOutPort={activeOutPort}
            selA={selA}
            selB={selB}
            usedIN={usedIN}
            usedOUTActive={usedOUTActive}
            fusedInToOut={fusedInToOut}
            fusedOutToIn={fusedOutToIn}
            onSelectIn={onSelectIn}
            onSelectOut={onSelectOut}
          />
        )}

        {tab === "SPLITTER" && (
          <SplitterTab
            ceo={ceo}
            splitType={splitType}
            splitMode={splitMode}
            activeSplitterId={activeSplitterId}
            activeSplitter={activeSplitter}
            splitterLegs={splitterLegs}
            activeLeg={activeLeg}
            pluggedPorts={pluggedPorts}
            leftPortId={leftPortId}
            rightPortId={rightPortId}
            leftCable={leftCable}
            rightCable={rightCable}
            onSetSplitType={setSplitType}
            onSetSplitMode={setSplitMode}
            onSetActiveSplitterId={setActiveSplitterId}
            onSetActiveLeg={setActiveLeg}
            onSetLeftPortId={setLeftPortId}
            onSetRightPortId={setRightPortId}
            onAddSplitter={onAddSplitter}
            onRemoveSplitter={onRemoveSplitter}
            onSetSplitterInputRef={onSetSplitterInputRef}
            onSetSplitterOutputRef={onSetSplitterOutputRef}
            onSetSplitterLegUnbalanced={onSetSplitterLegUnbalanced}
            getLegTarget={getLegTarget}
            refColor={refColor}
          />
        )}
      </div>

      {tab === "SPLICE" && <FusionListSection ceoId={ceo.id} fusoes={ceo.fusoes} onUnfuse={onUnfuse} />}

      <div style={{ marginTop: 14, fontSize: 12, color: "#666" }}>
        Cabos visiveis aqui: <b>{fibersPlugged.length}</b> (somente os plugados na CEO).
      </div>
    </div>
  )
}
