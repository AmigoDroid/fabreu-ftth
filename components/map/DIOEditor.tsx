"use client"

import React, { useMemo, useState } from "react"
import { CEO, FiberSegment } from "@/types/ftth"

type Props = {
  node: CEO
  fibers: FiberSegment[]
  onClose: () => void
  onAddOutPort: (nodeId: number) => void
  onConnectCable: (nodeId: number, portId: string, caboId: number | null) => void
  onFuse: (nodeId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onUnfuse: (nodeId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
  onActivateSignal: (nodeId: number, portId: string, fibraId: number, label: string) => void
  onClearSignal: () => void
  activeSignal: { nodeId: number; portId: string; fibraId: number; label: string } | null
}

export function DIOEditor({
  node,
  fibers,
  onClose,
  onAddOutPort,
  onConnectCable,
  onFuse,
  onUnfuse,
  onActivateSignal,
  onClearSignal,
  activeSignal
}: Props) {
  const ports = node.ports
  const pluggedPorts = useMemo(() => ports.filter((p) => p.caboId != null), [ports])
  const [leftPortId, setLeftPortId] = useState<string>(() => pluggedPorts[0]?.id ?? "IN-1")
  const [rightPortId, setRightPortId] = useState<string>(() => pluggedPorts[1]?.id ?? pluggedPorts[0]?.id ?? "OUT-1")
  const [pickA, setPickA] = useState<number | null>(null)
  const [pickB, setPickB] = useState<number | null>(null)

  const cableByPort = useMemo(() => {
    const map = new Map<string, FiberSegment | null>()
    for (const p of ports) map.set(p.id, p.caboId ? fibers.find((f) => f.id === p.caboId) ?? null : null)
    return map
  }, [ports, fibers])
  const leftCable = cableByPort.get(leftPortId) ?? null
  const rightCable = cableByPort.get(rightPortId) ?? null

  const used = useMemo(() => {
    const s = new Set<string>()
    for (const f of node.fusoes) {
      s.add(`${f.a.portId}::${f.a.fibraId}`)
      s.add(`${f.b.portId}::${f.b.fibraId}`)
    }
    return s
  }, [node.fusoes])

  function tryFuse(aId: number | null, bId: number | null) {
    if (!aId || !bId || !leftPortId || !rightPortId) return
    if (leftPortId === rightPortId) return
    onFuse(node.id, leftPortId, aId, rightPortId, bId)
    setPickA(null)
    setPickB(null)
  }

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
        background: "linear-gradient(155deg,#fff8f2 0%,#fff 65%)",
        border: "1px solid #efdac8",
        borderRadius: 14,
        boxShadow: "0 16px 36px rgba(87, 44, 12, .2)",
        padding: 14
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>{node.nome} (DIO)</div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>{node.descricao}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onAddOutPort(node.id)} style={{ border: "1px solid #e7cdb9", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "6px 10px" }}>+ Porta</button>
          {activeSignal?.nodeId === node.id && <button onClick={onClearSignal} style={{ border: "1px solid #e7cdb9", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "6px 10px" }}>Limpar sinal</button>}
          <button onClick={onClose} style={{ border: "1px solid #e7cdb9", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "6px 10px" }}>Fechar</button>
        </div>
      </div>

      <div style={{ marginTop: 10, border: "1px solid #f0dfcf", borderRadius: 10, padding: 10, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Conexao de cabos por porta</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          {ports.map((p) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{p.id}</div>
              <select value={p.caboId ?? ""} onChange={(e) => onConnectCable(node.id, p.id, e.target.value ? Number(e.target.value) : null)} style={{ border: "1px solid #e7cdb9", borderRadius: 8, padding: "6px 8px" }}>
                <option value="">Sem cabo</option>
                {fibers.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ border: "1px solid #f0dfcf", borderRadius: 10, padding: 10, background: "#fff" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Lado A</div>
          <select value={leftPortId} onChange={(e) => setLeftPortId(e.target.value)} style={{ width: "100%", border: "1px solid #e7cdb9", borderRadius: 8, padding: "6px 8px", marginBottom: 8 }}>
            {pluggedPorts.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
            {(leftCable?.fibras ?? []).map((f) => {
              const busy = used.has(`${leftPortId}::${f.id}`)
              return (
                <button
                  key={f.id}
                  disabled={busy}
                  onClick={() => {
                    const next = pickA === f.id ? null : f.id
                    setPickA(next)
                    tryFuse(next, pickB)
                  }}
                  onDoubleClick={() => onActivateSignal(node.id, leftPortId, f.id, `DIO ${leftPortId}`)}
                  style={{ border: pickA === f.id ? "2px solid #7c2d12" : "1px solid #e7cdb9", borderRadius: 8, background: busy ? "#f3f4f6" : "#fff", opacity: busy ? 0.6 : 1, padding: "6px 4px", cursor: busy ? "not-allowed" : "pointer", fontSize: 12 }}
                >
                  F{f.id}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ border: "1px solid #f0dfcf", borderRadius: 10, padding: 10, background: "#fff" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Lado B</div>
          <select value={rightPortId} onChange={(e) => setRightPortId(e.target.value)} style={{ width: "100%", border: "1px solid #e7cdb9", borderRadius: 8, padding: "6px 8px", marginBottom: 8 }}>
            {pluggedPorts.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
            {(rightCable?.fibras ?? []).map((f) => {
              const busy = used.has(`${rightPortId}::${f.id}`)
              return (
                <button
                  key={f.id}
                  disabled={busy}
                  onClick={() => {
                    const next = pickB === f.id ? null : f.id
                    setPickB(next)
                    tryFuse(pickA, next)
                  }}
                  onDoubleClick={() => onActivateSignal(node.id, rightPortId, f.id, `DIO ${rightPortId}`)}
                  style={{ border: pickB === f.id ? "2px solid #7c2d12" : "1px solid #e7cdb9", borderRadius: 8, background: busy ? "#f3f4f6" : "#fff", opacity: busy ? 0.6 : 1, padding: "6px 4px", cursor: busy ? "not-allowed" : "pointer", fontSize: 12 }}
                >
                  F{f.id}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, border: "1px solid #f0dfcf", borderRadius: 10, padding: 10, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Fusoes no DIO</div>
        <div style={{ display: "grid", gap: 6 }}>
          {node.fusoes.length === 0 && <div style={{ fontSize: 12, color: "#6b7280" }}>Nenhuma fusao configurada.</div>}
          {node.fusoes.map((f, i) => (
            <div key={`${i}-${f.a.portId}-${f.a.fibraId}-${f.b.portId}-${f.b.fibraId}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #f2e3d6", borderRadius: 8, padding: "6px 8px" }}>
              <div style={{ fontSize: 12 }}>{f.a.portId} F{f.a.fibraId} {"<->"} {f.b.portId} F{f.b.fibraId}</div>
              <button onClick={() => onUnfuse(node.id, f.a.portId, f.a.fibraId, f.b.portId, f.b.fibraId)} style={{ border: "1px solid #e7cdb9", borderRadius: 8, background: "#fff", cursor: "pointer", padding: "4px 8px" }}>
                Desfazer
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

