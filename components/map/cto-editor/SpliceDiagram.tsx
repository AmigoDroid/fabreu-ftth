import React from "react"
import { CEOFusion, FiberSegment } from "@/types/ftth"
import { chipStyle, dotStyle, SpliceCurve } from "./utils"

type Props = {
  containerRef?: React.RefObject<HTMLDivElement | null>
  title?: string
  leftTitle: string
  rightTitle: string
  caboIN: FiberSegment | null
  caboOUT: FiberSegment | null
  selA: number | null
  selB: number | null
  usedIN: Set<number>
  usedOUT: Set<number>
  onSelectA: (fibraId: number) => void
  onSelectB: (fibraId: number) => void
  curves: SpliceCurve[]
  fusoes?: CEOFusion[]
  ceoId?: number
  onUnfuse?: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
}

export function SpliceDiagram({
  containerRef,
  title,
  leftTitle,
  rightTitle,
  caboIN,
  caboOUT,
  selA,
  selB,
  usedIN,
  usedOUT,
  onSelectA,
  onSelectB,
  curves,
  fusoes,
  ceoId,
  onUnfuse
}: Props) {
  return (
    <div ref={containerRef} style={{ position: "relative", marginTop: title ? 0 : 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
        {curves.map((ln) => {
          const mid = (ln.b.x - ln.a.x) * 0.35
          const d = `M ${ln.a.x} ${ln.a.y} C ${ln.a.x + mid} ${ln.a.y}, ${ln.b.x - mid} ${ln.b.y}, ${ln.b.x} ${ln.b.y}`
          return <path key={ln.key} d={d} fill="none" stroke={ln.color} strokeWidth={3} strokeLinecap="round" opacity={0.92} />
        })}
      </svg>

      {title && <div style={{ position: "relative", zIndex: 2, fontWeight: 900, marginBottom: 8 }}>{title}</div>}

      <div style={{ position: "relative", zIndex: 2, display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>{leftTitle}</div>
          {!caboIN ? <div style={{ fontSize: 12, color: "#666" }}>Sem cabo.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {caboIN.fibras.map((f) => (
                <div key={f.id} data-cto-sp-in={f.id} style={chipStyle(selA === f.id, usedIN.has(f.id))} onClick={() => onSelectA(f.id)}><span style={dotStyle(f.cor)} />F{f.id}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", placeItems: "center" }}><div style={{ width: 24, height: "100%", border: "2px solid #111", borderRadius: 10 }} /></div>

        <div>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>{rightTitle}</div>
          {!caboOUT ? <div style={{ fontSize: 12, color: "#666" }}>Sem cabo.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {caboOUT.fibras.map((f) => (
                <div key={f.id} data-cto-sp-out={f.id} style={chipStyle(selB === f.id, usedOUT.has(f.id))} onClick={() => onSelectB(f.id)}><span style={dotStyle(f.cor)} />F{f.id}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {fusoes && onUnfuse && ceoId != null && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {fusoes.map((f, idx) => (
            <div key={`${idx}-${f.a.portId}-${f.a.fibraId}-${f.b.portId}-${f.b.fibraId}`} style={{ display: "flex", justifyContent: "space-between", border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
              <div style={{ fontSize: 12 }}><b>{f.a.portId}</b>:F{f.a.fibraId} <b>&lt;-&gt;</b> <b>{f.b.portId}</b>:F{f.b.fibraId}</div>
              <button onClick={() => onUnfuse(ceoId, f.a.portId, f.a.fibraId, f.b.portId, f.b.fibraId)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 8, cursor: "pointer" }}>Desfazer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
