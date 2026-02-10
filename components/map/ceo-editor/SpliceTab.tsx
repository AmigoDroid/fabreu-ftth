import React from "react"
import { CEOPort, FiberSegment } from "@/types/ftth"
import { chipStyle, dotStyle } from "./utils"

type Props = {
  caboIN: FiberSegment | null
  caboOUT: FiberSegment | null
  activeOutPort: CEOPort | null
  selA: number | null
  selB: number | null
  usedIN: Set<number>
  usedOUTActive: Set<number>
  fusedInToOut: Map<number, number>
  fusedOutToIn: Map<number, number>
  onSelectIn: (fibraId: number) => void
  onSelectOut: (fibraId: number) => void
}

export function SpliceTab({
  caboIN,
  caboOUT,
  activeOutPort,
  selA,
  selB,
  usedIN,
  usedOUTActive,
  fusedInToOut,
  fusedOutToIn,
  onSelectIn,
  onSelectOut
}: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 1fr", gap: 12, alignItems: "start" }}>
      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          IN-1 {caboIN ? `- ${caboIN.nome}` : "- (sem cabo)"}
        </div>

        {!caboIN ? (
          <div style={{ fontSize: 12, color: "#666" }}>Conecte um cabo na Entrada para liberar as fibras.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {caboIN.fibras.map((f) => {
              const active = selA === f.id
              const disabled = usedIN.has(f.id)
              return (
                <div
                  key={f.id}
                  data-sp-in={f.id}
                  style={chipStyle(active, disabled)}
                  onClick={() => onSelectIn(f.id)}
                  title={disabled ? "Esta fibra de entrada ja esta fusionada em alguma saida." : "Clique para selecionar"}
                >
                  <span style={dotStyle(f.cor)} />
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                  <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                    {fusedInToOut.has(f.id) ? `OUT ${fusedInToOut.get(f.id)}` : "-"}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ position: "sticky", top: 0, alignSelf: "start", zIndex: 3, height: "fit-content" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            border: "2px solid #111",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            background: "#fff"
          }}
        >
          CEO
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          {activeOutPort?.id ?? "OUT"} {caboOUT ? `- ${caboOUT.nome}` : "- (sem cabo)"}
        </div>

        {!caboOUT ? (
          <div style={{ fontSize: 12, color: "#666" }}>Conecte um cabo na saida selecionada para liberar as fibras.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {caboOUT.fibras.map((f) => {
              const active = selB === f.id
              const disabled = usedOUTActive.has(f.id)
              return (
                <div
                  key={f.id}
                  data-sp-out={f.id}
                  style={chipStyle(active, disabled)}
                  onClick={() => onSelectOut(f.id)}
                >
                  <span style={dotStyle(f.cor)} />
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                  <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                    {fusedOutToIn.has(f.id) ? `IN ${fusedOutToIn.get(f.id)}` : "-"}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
