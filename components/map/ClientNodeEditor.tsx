"use client"

import React, { useState } from "react"
import { CEO, FiberSegment } from "@/types/ftth"

type Props = {
  node: CEO
  fibers: FiberSegment[]
  onClose: () => void
  onConnectCable: (nodeId: number, portId: string, caboId: number | null) => void
  onActivateSignal: (nodeId: number, portId: string, fibraId: number, label: string) => void
  onClearSignal: () => void
  activeSignal: { nodeId: number; portId: string; fibraId: number; label: string } | null
}

export function ClientNodeEditor({
  node,
  fibers,
  onClose,
  onConnectCable,
  onActivateSignal,
  onClearSignal,
  activeSignal
}: Props) {
  const inPort = node.ports.find((p) => p.id === "IN-1") ?? node.ports[0] ?? null
  const cable = inPort?.caboId ? fibers.find((f) => f.id === inPort.caboId) ?? null : null
  const [fiberId, setFiberId] = useState(1)

  return (
    <div style={{ position: "absolute", top: 20, right: 20, zIndex: 1200, width: 520, background: "linear-gradient(160deg,#f7f3ff 0%,#fff 70%)", border: "1px solid #e4d8fb", borderRadius: 12, boxShadow: "0 14px 30px rgba(76,29,149,.18)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <div style={{ fontWeight: 900 }}>{node.nome} (Cliente)</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{node.descricao}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {activeSignal?.nodeId === node.id && <button onClick={onClearSignal} style={{ border: "1px solid #d7c6fb", borderRadius: 8, background: "#fff", padding: "6px 8px", cursor: "pointer" }}>Limpar sinal</button>}
          <button onClick={onClose} style={{ border: "1px solid #d7c6fb", borderRadius: 8, background: "#fff", padding: "6px 8px", cursor: "pointer" }}>Fechar</button>
        </div>
      </div>

      {inPort && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <select value={inPort.caboId ?? ""} onChange={(e) => onConnectCable(node.id, inPort.id, e.target.value ? Number(e.target.value) : null)} style={{ border: "1px solid #d7c6fb", borderRadius: 8, padding: "8px 10px" }}>
            <option value="">Sem cabo</option>
            {fibers.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>

          <div style={{ display: "flex", gap: 8 }}>
            <select disabled={!cable} value={fiberId} onChange={(e) => setFiberId(Number(e.target.value))} style={{ border: "1px solid #d7c6fb", borderRadius: 8, padding: "8px 10px", minWidth: 140 }}>
              {(cable?.fibras ?? []).map((core) => <option key={core.id} value={core.id}>Fibra {core.id}</option>)}
            </select>
            <button disabled={!cable} onClick={() => onActivateSignal(node.id, inPort.id, fiberId, "Cliente")} style={{ border: "1px solid #d7c6fb", borderRadius: 8, background: !cable ? "#f3f4f6" : "#4c1d95", color: !cable ? "#9ca3af" : "#fff", padding: "8px 10px", cursor: !cable ? "not-allowed" : "pointer" }}>
              Mostrar fibra ativa
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
