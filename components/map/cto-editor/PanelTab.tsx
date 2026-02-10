import React from "react"
import { CEO, CEOSplitter, CTODropStatus, FiberSegment } from "@/types/ftth"
import { dotStyle, SpliceCurve, tubeGroups } from "./utils"
import { SpliceDiagram } from "./SpliceDiagram"

type Props = {
  ceo: CEO
  fibers: FiberSegment[]
  pluggedPorts: CEO["ports"]
  ctoModel: NonNullable<CEO["ctoModel"]>
  fullscreen: boolean
  activeSecondary: CEOSplitter | null
  activeOutLeg: number
  activeOutPortId: string
  dropClientName: string
  setDropClientName: (value: string) => void
  onSetCableTubeSize: (ceoId: number, cableId: number, tubeSize: 2 | 4 | 6 | 12) => void
  onAddDrop: (ceoId: number, splitterId: string, leg: number, target: { portId: string; fibraId: number } | null, clientName: string) => void
  onUpdateDrop: (
    ceoId: number,
    dropId: string,
    patch: Partial<{ clientName: string; clientCode: string; notes: string; status: CTODropStatus; target: { portId: string; fibraId: number } | null }>
  ) => void
  onRemoveDrop: (ceoId: number, dropId: string) => void
  spliceContainerRef: React.RefObject<HTMLDivElement | null>
  caboIN: FiberSegment | null
  caboOUT: FiberSegment | null
  selA: number | null
  selB: number | null
  usedIN: Set<number>
  usedOUT: Set<number>
  onSelectA: (fibraId: number) => void
  onSelectB: (fibraId: number) => void
  spliceCurves: SpliceCurve[]
}

export function PanelTab({
  ceo,
  fibers,
  pluggedPorts,
  ctoModel,
  fullscreen,
  activeSecondary,
  activeOutLeg,
  activeOutPortId,
  dropClientName,
  setDropClientName,
  onSetCableTubeSize,
  onAddDrop,
  onUpdateDrop,
  onRemoveDrop,
  spliceContainerRef,
  caboIN,
  caboOUT,
  selA,
  selB,
  usedIN,
  usedOUT,
  onSelectA,
  onSelectB,
  spliceCurves
}: Props) {
  return (
    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: fullscreen ? "1fr" : "1.2fr 1fr", gap: 12 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Cabos e tubos loose</div>
        {pluggedPorts.length === 0 ? <div style={{ fontSize: 12, color: "#666" }}>Sem cabos conectados.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pluggedPorts.map((p) => {
              if (!p.caboId) return null
              const cable = fibers.find((f) => f.id === p.caboId)
              if (!cable) return null
              const tubeSize = ctoModel.cableTubes.find((t) => t.cableId === cable.id)?.tubeSize ?? 12
              return (
                <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{p.label} | {cable.nome} | {cable.fibras.length}F</div>
                    <select value={tubeSize} onChange={(e) => onSetCableTubeSize(ceo.id, cable.id, Number(e.target.value) as 2 | 4 | 6 | 12)} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #ddd" }}>
                      <option value={2}>Tubo 2F</option>
                      <option value={4}>Tubo 4F</option>
                      <option value={6}>Tubo 6F</option>
                      <option value={12}>Tubo 12F</option>
                    </select>
                  </div>

                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                    {tubeGroups(cable.fibras.length, tubeSize).map((g) => (
                      <div key={g.tube} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 900 }}>Tubo {g.tube} | F{g.start}-F{g.end}</div>
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {cable.fibras.filter((x) => x.id >= g.start && x.id <= g.end).map((x) => (
                            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #eee", borderRadius: 999, padding: "2px 6px", fontSize: 11 }}><span style={{ ...dotStyle(x.cor), width: 10, height: 10 }} />F{x.id}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Drops para clientes</div>
        {!activeSecondary ? <div style={{ fontSize: 12, color: "#666" }}>Selecione um splitter de atendimento na aba Splitters.</div> : (
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
            <input value={dropClientName} onChange={(e) => setDropClientName(e.target.value)} placeholder="Nome do cliente" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }} />
            <button
              onClick={() => onAddDrop(ceo.id, activeSecondary.id, activeOutLeg, activeSecondary.outputs.find((o) => o.leg === activeOutLeg)?.target ?? null, dropClientName)}
              style={{ border: "1px solid #ddd", background: "#111", color: "#fff", borderRadius: 10, cursor: "pointer" }}
            >
              + Drop OUT {activeOutLeg}
            </button>
          </div>
        )}

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {ctoModel.drops.length === 0 ? <div style={{ fontSize: 12, color: "#666" }}>Nenhum drop.</div> : ctoModel.drops.map((d) => (
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
              <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>OUT {d.leg} | alvo: {d.target ? `${d.target.portId} F${d.target.fibraId}` : "nao definido"}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <SpliceDiagram
          containerRef={spliceContainerRef}
          title="Bandeja de fusao interativa"
          leftTitle="Alimentacao IN-1"
          rightTitle={`Distribuicao ${activeOutPortId}`}
          caboIN={caboIN}
          caboOUT={caboOUT}
          selA={selA}
          selB={selB}
          usedIN={usedIN}
          usedOUT={usedOUT}
          onSelectA={onSelectA}
          onSelectB={onSelectB}
          curves={spliceCurves}
        />
      </div>
    </div>
  )
}
