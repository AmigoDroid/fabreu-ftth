"use client"

import React, { useMemo, useState } from "react"
import { CEO, FiberSegment, OLTGbicClass, OLTSignalProfile } from "@/types/ftth"

type Props = {
  node: CEO
  fibers: FiberSegment[]
  onClose: () => void
  onAddSlot: (nodeId: number) => void
  onAddPon: (nodeId: number, slotId: string) => void
  onSetPonConfig: (
    nodeId: number,
    slotId: string,
    ponId: string,
    patch: Partial<{ gbicClass: OLTGbicClass; signalProfile: OLTSignalProfile; txDbm: number; enabled: boolean }>
  ) => void
  onConnectCable: (nodeId: number, portId: string, caboId: number | null) => void
  onActivateSignal: (nodeId: number, portId: string, fibraId: number, label: string) => void
  onClearSignal: () => void
  activeSignal: { nodeId: number; portId: string; fibraId: number; label: string } | null
}

export function OLTEditor({
  node,
  fibers,
  onClose,
  onAddSlot,
  onAddPon,
  onSetPonConfig,
  onConnectCable,
  onActivateSignal,
  onClearSignal,
  activeSignal
}: Props) {
  const slots = node.oltModel?.slots ?? []
  const [fiberPickByPort, setFiberPickByPort] = useState<Record<string, number>>({})

  const cableByPort = useMemo(() => {
    const map = new Map<string, FiberSegment | null>()
    for (const p of node.ports) {
      map.set(p.id, p.caboId ? fibers.find((f) => f.id === p.caboId) ?? null : null)
    }
    return map
  }, [node.ports, fibers])

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        zIndex: 1200,
        width: 980,
        maxHeight: "90vh",
        overflow: "auto",
        background: "linear-gradient(150deg,#f6fff9 0%,#fff 70%)",
        border: "1px solid #d8eadf",
        borderRadius: 14,
        boxShadow: "0 16px 36px rgba(14, 60, 35, .2)",
        padding: 14
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>{node.nome} (OLT)</div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>{node.descricao}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {activeSignal?.nodeId === node.id && (
            <button onClick={onClearSignal} style={{ border: "1px solid #c7dfd0", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
              Limpar sinal ativo
            </button>
          )}
          <button onClick={onClose} style={{ border: "1px solid #c7dfd0", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
            Fechar
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button onClick={() => onAddSlot(node.id)} style={{ border: "1px solid #c7dfd0", background: "#14532d", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontWeight: 800 }}>
          + Slot
        </button>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {slots.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>Nenhum slot cadastrado.</div>}
        {slots.map((slot) => (
          <div key={slot.id} style={{ border: "1px solid #d8eadf", borderRadius: 12, background: "#fff", padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>{slot.label}</div>
              <button onClick={() => onAddPon(node.id, slot.id)} style={{ border: "1px solid #c7dfd0", background: "#fff", borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}>
                + PON
              </button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {(slot.pons ?? []).map((pon) => {
                const cable = cableByPort.get(pon.portId) ?? null
                const selectedFiber = fiberPickByPort[pon.portId] ?? 1
                return (
                  <div key={pon.id} style={{ border: "1px solid #e3ece6", borderRadius: 10, padding: 8, background: "#fbfffc" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 130px 1fr auto", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>{pon.label}</div>
                      <select value={pon.gbicClass} onChange={(e) => onSetPonConfig(node.id, slot.id, pon.id, { gbicClass: e.target.value as OLTGbicClass })} style={{ border: "1px solid #d4e3d9", borderRadius: 8, padding: "6px 8px" }}>
                        <option value="B+">GBIC B+</option>
                        <option value="C+">GBIC C+</option>
                        <option value="C++">GBIC C++</option>
                        <option value="XGS-PON-N1">XGS N1</option>
                        <option value="XGS-PON-N2">XGS N2</option>
                      </select>
                      <select value={pon.signalProfile} onChange={(e) => onSetPonConfig(node.id, slot.id, pon.id, { signalProfile: e.target.value as OLTSignalProfile })} style={{ border: "1px solid #d4e3d9", borderRadius: 8, padding: "6px 8px" }}>
                        <option value="GPON">GPON</option>
                        <option value="XGS-PON">XGS-PON</option>
                        <option value="EPON">EPON</option>
                      </select>
                      <select value={node.ports.find((p) => p.id === pon.portId)?.caboId ?? ""} onChange={(e) => onConnectCable(node.id, pon.portId, e.target.value ? Number(e.target.value) : null)} style={{ border: "1px solid #d4e3d9", borderRadius: 8, padding: "6px 8px" }}>
                        <option value="">Sem cabo</option>
                        {fibers.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={pon.enabled} onChange={(e) => onSetPonConfig(node.id, slot.id, pon.id, { enabled: e.target.checked })} />
                        Ativa
                      </label>
                    </div>

                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={selectedFiber}
                        onChange={(e) => setFiberPickByPort((prev) => ({ ...prev, [pon.portId]: Number(e.target.value) }))}
                        style={{ border: "1px solid #d4e3d9", borderRadius: 8, padding: "6px 8px", minWidth: 120 }}
                        disabled={!cable}
                      >
                        {(cable?.fibras ?? []).map((core) => <option key={core.id} value={core.id}>Fibra {core.id}</option>)}
                      </select>
                      <button
                        disabled={!cable || !pon.enabled}
                        onClick={() => onActivateSignal(node.id, pon.portId, selectedFiber, `${slot.label}/${pon.label}`)}
                        style={{ border: "1px solid #c7dfd0", background: !cable || !pon.enabled ? "#f3f4f6" : "#14532d", color: !cable || !pon.enabled ? "#9ca3af" : "#fff", borderRadius: 8, padding: "6px 10px", cursor: !cable || !pon.enabled ? "not-allowed" : "pointer" }}
                      >
                        Acender fibra no mapa
                      </button>
                      <div style={{ fontSize: 11, color: "#4b5563" }}>
                        Porta: {pon.portId} | Cabo: {cable?.nome ?? "nao conectado"}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

