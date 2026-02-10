import React from "react"
import { CEOPort, FiberSegment } from "@/types/ftth"

type Props = {
  ceoId: number
  inPort: CEOPort | null
  outPorts: CEOPort[]
  activeOutPortId: string
  fibers: FiberSegment[]
  onAddOutPort: (ceoId: number) => void
  onConnectCable: (ceoId: number, portId: string, caboId: number | null) => void
  onSetActiveOutPortId: (portId: string) => void
}

export function CableConnectionsSection({
  ceoId,
  inPort,
  outPorts,
  activeOutPortId,
  fibers,
  onAddOutPort,
  onConnectCable,
  onSetActiveOutPortId
}: Props) {
  return (
    <div style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Cabos na CEO</div>
        <button
          onClick={() => onAddOutPort(ceoId)}
          style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
        >
          + Saida
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
        <div style={{ width: 90, fontWeight: 900 }}>Entrada</div>
        <select
          value={inPort?.caboId ?? ""}
          onChange={(e) => onConnectCable(ceoId, "IN-1", e.target.value ? Number(e.target.value) : null)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="">- sem cabo -</option>
          {fibers.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {outPorts.map((p) => (
          <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => onSetActiveOutPortId(p.id)}
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
              title="Selecionar esta saida"
            >
              {p.label}
            </button>

            <select
              value={p.caboId ?? ""}
              onChange={(e) => onConnectCable(ceoId, p.id, e.target.value ? Number(e.target.value) : null)}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="">- sem cabo -</option>
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
  )
}
