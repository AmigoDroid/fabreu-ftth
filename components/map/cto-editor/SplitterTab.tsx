import React from "react"
import { CEO, CEOSplitter, FiberSegment, SplitterRef } from "@/types/ftth"
import { chipStyle, dotStyle, legsFromType, refKey } from "./utils"

type Props = {
  ceo: CEO
  primary: CEOSplitter | null
  secondaries: CEOSplitter[]
  activeSecondaryId: string | null
  activeSecondary: CEOSplitter | null
  activeOutLeg: number
  secondaryType: "1x8" | "1x16"
  secondaryLeg: number | null
  leftPortId: string
  targetPortId: string
  pluggedPorts: CEO["ports"]
  cableByPort: Map<string, FiberSegment | null>
  used: Set<string>
  onSetActiveSecondaryId: (id: string) => void
  onSetActiveOutLeg: (leg: number) => void
  onSetSecondaryType: (type: "1x8" | "1x16") => void
  onSetSecondaryLeg: (leg: number | null) => void
  onSetLeftPortId: (portId: string) => void
  onSetTargetPortId: (portId: string) => void
  onAddCTOPrimarySplitter: (ceoId: number) => void
  onSetSplitterInputRef: (ceoId: number, splitterId: string, ref: SplitterRef | null) => void
  onAddCTOSecondarySplitter: (ceoId: number, type: "1x8" | "1x16", parentLeg: number | null) => void
  onRemoveSplitter: (ceoId: number, splitterId: string) => void
  onSetSplitterOutputRef: (ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) => void
}

export function SplitterTab({
  ceo,
  primary,
  secondaries,
  activeSecondaryId,
  activeSecondary,
  activeOutLeg,
  secondaryType,
  secondaryLeg,
  leftPortId,
  targetPortId,
  pluggedPorts,
  cableByPort,
  used,
  onSetActiveSecondaryId,
  onSetActiveOutLeg,
  onSetSecondaryType,
  onSetSecondaryLeg,
  onSetLeftPortId,
  onSetTargetPortId,
  onAddCTOPrimarySplitter,
  onSetSplitterInputRef,
  onAddCTOSecondarySplitter,
  onRemoveSplitter,
  onSetSplitterOutputRef
}: Props) {
  return (
    <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 900 }}>Primario sem conector</div>
        {!primary && <button onClick={() => onAddCTOPrimarySplitter(ceo.id)} style={{ border: "1px solid #ddd", background: "#111", color: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>+ Primario 1x8</button>}
      </div>

      {primary && (
        <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
          <select value={leftPortId} onChange={(e) => onSetLeftPortId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}>
            {pluggedPorts.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.id})</option>)}
          </select>
          {leftPortId && cableByPort.get(leftPortId) && (
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
              {(cableByPort.get(leftPortId)?.fibras ?? []).map((f) => {
                const ref: SplitterRef = { portId: leftPortId, fibraId: f.id }
                const active = primary.input?.portId === ref.portId && primary.input?.fibraId === ref.fibraId
                const busy = used.has(refKey(ref)) && !active
                return (
                  <div key={f.id} style={chipStyle(active, busy)} onClick={() => !busy && onSetSplitterInputRef(ceo.id, primary.id, ref)}>
                    <span style={dotStyle(f.cor)} />{f.nome}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Splitters de atendimento conectorizados</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 8 }}>
          <select value={secondaryType} onChange={(e) => onSetSecondaryType(e.target.value as "1x8" | "1x16")} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}>
            <option value="1x8">1x8</option>
            <option value="1x16">1x16</option>
          </select>
          <select value={secondaryLeg == null ? "" : String(secondaryLeg)} onChange={(e) => onSetSecondaryLeg(e.target.value ? Number(e.target.value) : null)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}>
            <option value="">Entrada por fusao</option>
            {Array.from({ length: 8 }, (_, i) => i + 1)
              .filter((leg) => !secondaries.some((s) => s.parentLeg === leg))
              .map((leg) => <option key={leg} value={leg}>Perna {leg}</option>)}
          </select>
          <button onClick={() => onAddCTOSecondarySplitter(ceo.id, secondaryType, secondaryLeg)} style={{ border: "1px solid #ddd", background: "#111", color: "#fff", borderRadius: 10, cursor: "pointer" }}>+ Add</button>
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {secondaries.map((s) => (
            <button key={s.id} onClick={() => onSetActiveSecondaryId(s.id)} style={{ border: "1px solid #ddd", background: s.id === activeSecondaryId ? "#111" : "#fff", color: s.id === activeSecondaryId ? "#fff" : "#111", borderRadius: 999, padding: "6px 10px", cursor: "pointer", fontWeight: 900 }}>
              {s.type} P{s.parentLeg ?? "-"}
            </button>
          ))}
        </div>

        {activeSecondary && (
          <div style={{ marginTop: 10, border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
              <select value={activeOutLeg} onChange={(e) => onSetActiveOutLeg(Number(e.target.value))} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}>
                {legsFromType(activeSecondary.type).map((leg) => <option key={leg} value={leg}>OUT {leg}</option>)}
              </select>
              <select value={targetPortId} onChange={(e) => onSetTargetPortId(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}>
                {pluggedPorts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <button onClick={() => onRemoveSplitter(ceo.id, activeSecondary.id)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>Remover</button>
            </div>

            {targetPortId && cableByPort.get(targetPortId) && (
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                {(cableByPort.get(targetPortId)?.fibras ?? []).map((f) => {
                  const ref: SplitterRef = { portId: targetPortId, fibraId: f.id }
                  const current = activeSecondary.outputs.find((o) => o.leg === activeOutLeg)?.target
                  const active = current?.portId === ref.portId && current?.fibraId === ref.fibraId
                  const busy = used.has(refKey(ref)) && !active
                  return (
                    <div key={f.id} style={chipStyle(active, busy)} onClick={() => !busy && onSetSplitterOutputRef(ceo.id, activeSecondary.id, activeOutLeg, ref)}>
                      <span style={dotStyle(f.cor)} />{f.nome}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
