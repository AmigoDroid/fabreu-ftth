import React from "react"
import { CEOFusion } from "@/types/ftth"

type Props = {
  ceoId: number
  fusoes: CEOFusion[]
  onUnfuse: (ceoId: number, aPortId: string, aFibraId: number, bPortId: string, bFibraId: number) => void
}

export function FusionListSection({ ceoId, fusoes, onUnfuse }: Props) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Fusoes (Splice)</div>

      {fusoes.length === 0 ? (
        <div style={{ fontSize: 12, color: "#666" }}>
          Selecione uma fibra do IN-1 e depois uma fibra do OUT ativo para criar a fusao.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {fusoes.map((f, idx) => (
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
                <b>{f.a.portId}</b>:<b>{f.a.fibraId}</b> {"<->"} <b>{f.b.portId}</b>:<b>{f.b.fibraId}</b>
              </div>
              <button
                onClick={() => onUnfuse(ceoId, f.a.portId, f.a.fibraId, f.b.portId, f.b.fibraId)}
                style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
              >
                Desfazer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
