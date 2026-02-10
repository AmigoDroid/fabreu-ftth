import React from "react"
import { CEO, CEOSplitter, CEOSplitterMode, CEOSplitterType, FiberSegment, SplitterRef } from "@/types/ftth"
import { chipStyle, dotStyle } from "./utils"

type Props = {
  ceo: CEO
  splitType: CEOSplitterType
  splitMode: CEOSplitterMode
  activeSplitterId: string | null
  activeSplitter: CEOSplitter | null
  splitterLegs: number[]
  activeLeg: number
  pluggedPorts: CEO["ports"]
  leftPortId: string
  rightPortId: string
  leftCable: FiberSegment | null
  rightCable: FiberSegment | null
  onSetSplitType: (type: CEOSplitterType) => void
  onSetSplitMode: (mode: CEOSplitterMode) => void
  onSetActiveSplitterId: (id: string) => void
  onSetActiveLeg: (leg: number) => void
  onSetLeftPortId: (portId: string) => void
  onSetRightPortId: (portId: string) => void
  onAddSplitter: (ceoId: number, type: CEOSplitterType, mode: CEOSplitterMode) => void
  onRemoveSplitter: (ceoId: number, splitterId: string) => void
  onSetSplitterInputRef: (ceoId: number, splitterId: string, ref: SplitterRef | null) => void
  onSetSplitterOutputRef: (ceoId: number, splitterId: string, leg: number, ref: SplitterRef | null) => void
  onSetSplitterLegUnbalanced: (ceoId: number, splitterId: string, leg: number, percent: number) => void
  getLegTarget: (leg: number) => SplitterRef | null
  refColor: (ref: SplitterRef | null) => string
}

function refLabel(ref: SplitterRef | null) {
  if (!ref) return "-"
  return `${ref.portId} / Fibra ${ref.fibraId}`
}

export function SplitterTab({
  ceo,
  splitType,
  splitMode,
  activeSplitterId,
  activeSplitter,
  splitterLegs,
  activeLeg,
  pluggedPorts,
  leftPortId,
  rightPortId,
  leftCable,
  rightCable,
  onSetSplitType,
  onSetSplitMode,
  onSetActiveSplitterId,
  onSetActiveLeg,
  onSetLeftPortId,
  onSetRightPortId,
  onAddSplitter,
  onRemoveSplitter,
  onSetSplitterInputRef,
  onSetSplitterOutputRef,
  onSetSplitterLegUnbalanced,
  getLegTarget,
  refColor
}: Props) {
  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Adicionar Splitter</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 10, alignItems: "center" }}>
          <select
            value={splitType}
            onChange={(e) => onSetSplitType(e.target.value as CEOSplitterType)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="1x2">1x2</option>
            <option value="1x4">1x4</option>
            <option value="1x8">1x8</option>
            <option value="1x16">1x16</option>
          </select>

          <select
            value={splitMode}
            onChange={(e) => onSetSplitMode(e.target.value as CEOSplitterMode)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="BALANCED">Balanceado</option>
            <option value="UNBALANCED">Desbalanceado</option>
          </select>

          <button
            onClick={() => onAddSplitter(ceo.id, splitType, splitMode)}
            style={{
              border: "1px solid #ddd",
              background: "#111",
              color: "#fff",
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              fontWeight: 900
            }}
          >
            + Adicionar
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {ceo.splitters.map((s) => (
          <button
            key={s.id}
            onClick={() => onSetActiveSplitterId(s.id)}
            style={{
              border: "1px solid #ddd",
              background: s.id === activeSplitterId ? "#111" : "#fff",
              color: s.id === activeSplitterId ? "#fff" : "#111",
              borderRadius: 999,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 900
            }}
            title="Selecionar splitter"
          >
            {s.type} - {s.mode === "BALANCED" ? "BAL" : "DES"} - {s.lossDb.toFixed(1)}dB
          </button>
        ))}
      </div>

      {!activeSplitter ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>Nenhum splitter selecionado.</div>
      ) : (
        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>
              Splitter {activeSplitter.type} ({activeSplitter.mode === "BALANCED" ? "Balanceado" : "Desbalanceado"}) - Loss{" "}
              {activeSplitter.lossDb.toFixed(2)} dB
            </div>

            <button
              onClick={() => onRemoveSplitter(ceo.id, activeSplitter.id)}
              style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
            >
              Remover
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 220px", gap: 10, marginTop: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Cabo da esquerda (fonte)</div>
              <select
                value={leftPortId}
                onChange={(e) => onSetLeftPortId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
              >
                {pluggedPorts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Cabo da direita (alvos)</div>
              <select
                value={rightPortId}
                onChange={(e) => onSetRightPortId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd" }}
              >
                {pluggedPorts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>Perna ativa</div>
              <select
                value={activeLeg}
                onChange={(e) => onSetActiveLeg(Number(e.target.value))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", fontWeight: 900 }}
              >
                {splitterLegs.map((leg) => (
                  <option key={leg} value={leg}>
                    OUT {leg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px 1fr", gap: 12, marginTop: 12, alignItems: "start" }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                Esquerda - {leftCable ? leftCable.nome : "(sem cabo)"}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                Clique numa fibra para virar a <b>entrada branca</b> do splitter.
              </div>

              {!leftCable ? (
                <div style={{ fontSize: 12, color: "#666" }}>Selecione uma porta plugada.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {leftCable.fibras.map((f) => {
                    const ref: SplitterRef = { portId: leftPortId, fibraId: f.id }
                    const active = activeSplitter.input?.portId === ref.portId && activeSplitter.input?.fibraId === ref.fibraId

                    return (
                      <div
                        key={f.id}
                        data-spl-left={`${leftPortId}:${f.id}`}
                        style={chipStyle(active, false)}
                        onClick={() => onSetSplitterInputRef(ceo.id, activeSplitter.id, ref)}
                        title="Definir como entrada do splitter"
                      >
                        <span style={dotStyle(f.cor)} />
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>{active ? "IN" : "-"}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                onClick={() => onSetSplitterInputRef(ceo.id, activeSplitter.id, null)}
                style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
              >
                Limpar entrada
              </button>
            </div>

            <div style={{ position: "sticky", top: 0, alignSelf: "start", zIndex: 3 }}>
              <div style={{ border: "2px solid #111", borderRadius: 14, padding: 12, background: "#fff" }}>
                <div style={{ fontWeight: 950, textAlign: "center" }}>SPLITTER</div>
                <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>
                  {activeSplitter.type} - {activeSplitter.mode === "BALANCED" ? "BAL" : "DES"} - {activeSplitter.lossDb.toFixed(1)} dB
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div
                      data-spl-pin-in="1"
                      title={activeSplitter.input ? `Entrada: ${refLabel(activeSplitter.input)}` : "Entrada (branca)"}
                      style={{ width: 18, height: 18, borderRadius: 999, background: "#fff", border: "2px solid #111" }}
                    />
                    <div style={{ fontSize: 11, fontWeight: 900 }}>IN</div>
                  </div>

                  <div style={{ flex: 1, margin: "0 10px", height: 130 }}>
                    <svg width="100%" height="100%" viewBox="0 0 240 130">
                      <rect x="60" y="10" width="120" height="110" rx="14" fill="#fff" stroke="#111" strokeWidth="2" />
                      <text x="120" y="44" textAnchor="middle" fontSize="14" fontWeight="900" fill="#111">
                        {activeSplitter.type}
                      </text>
                      <text x="120" y="68" textAnchor="middle" fontSize="10" fontWeight="800" fill="#666">
                        {activeSplitter.mode === "BALANCED" ? "BALANCED" : "UNBALANCED"}
                      </text>

                      {splitterLegs.map((leg) => {
                        const y = 25 + (leg - 0.5) * (90 / splitterLegs.length)
                        const tgt = getLegTarget(leg)
                        const col = tgt ? refColor(tgt) : "#bbb"
                        return (
                          <path
                            key={`inside-${leg}`}
                            d={`M 60 65 C 85 65, 95 ${y}, 180 ${y}`}
                            fill="none"
                            stroke={col}
                            strokeWidth="2"
                            opacity="0.9"
                          />
                        )
                      })}
                    </svg>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                    {splitterLegs.map((leg) => {
                      const tgt = getLegTarget(leg)
                      const col = tgt ? refColor(tgt) : "#fff"
                      const active = activeLeg === leg
                      return (
                        <button
                          key={leg}
                          data-spl-leg={leg}
                          onClick={() => onSetActiveLeg(leg)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 10,
                            border: active ? "2px solid #111" : "1px solid #ddd",
                            background: col,
                            cursor: "pointer"
                          }}
                          title={tgt ? `OUT ${leg}: ${refLabel(tgt)}` : `OUT ${leg} (vazio)`}
                        />
                      )
                    })}
                    <div style={{ fontSize: 11, fontWeight: 900, marginTop: 4 }}>OUT</div>
                  </div>
                </div>

                {activeSplitter.mode === "UNBALANCED" && (
                  <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>Desbalanceado (%)</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {activeSplitter.outputs.map((o) => (
                        <div
                          key={o.leg}
                          style={{ border: "1px solid #eee", borderRadius: 12, padding: "8px 10px", display: "flex", gap: 8, alignItems: "center" }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 900 }}>OUT {o.leg}</div>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={activeSplitter.unbalanced?.[o.leg] ?? 0}
                            onChange={(e) => onSetSplitterLegUnbalanced(ceo.id, activeSplitter.id, o.leg, Number(e.target.value || 0))}
                            style={{ width: 70, padding: "6px 8px", borderRadius: 10, border: "1px solid #ddd" }}
                          />
                          <div style={{ fontSize: 12, color: "#666" }}>%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                Direita - {rightCable ? rightCable.nome : "(sem cabo)"}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                Clique numa fibra para ligar a <b>Perna OUT {activeLeg}</b>.
              </div>

              {!activeSplitter.input ? (
                <div style={{ fontSize: 12, color: "#666", border: "1px dashed #ddd", padding: 10, borderRadius: 12 }}>
                  Defina primeiro a <b>entrada</b> do splitter clicando numa fibra do lado esquerdo.
                </div>
              ) : !rightCable ? (
                <div style={{ fontSize: 12, color: "#666" }}>Selecione uma porta plugada.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rightCable.fibras.map((f) => {
                    const ref: SplitterRef = { portId: rightPortId, fibraId: f.id }
                    const current = getLegTarget(activeLeg)
                    const active = current?.portId === ref.portId && current?.fibraId === ref.fibraId

                    return (
                      <div
                        key={f.id}
                        data-spl-right={`${rightPortId}:${f.id}`}
                        style={chipStyle(active, false)}
                        onClick={() => onSetSplitterOutputRef(ceo.id, activeSplitter.id, activeLeg, ref)}
                        title={`Ligar OUT ${activeLeg} aqui`}
                      >
                        <span style={dotStyle(f.cor)} />
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{f.nome}</div>
                        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
                          {active ? `OUT ${activeLeg}` : "-"}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                onClick={() => onSetSplitterOutputRef(ceo.id, activeSplitter.id, activeLeg, null)}
                style={{ marginTop: 10, border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
              >
                Limpar perna OUT {activeLeg}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            Cada perna pode ligar em qualquer fibra (mesmo cabo ou outro), desde que a porta esteja plugada na CEO.
          </div>
        </div>
      )}
    </div>
  )
}
