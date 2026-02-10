import React from "react"

type Props = {
  ceoName: string
  ceoDescription: string
  tab: "PANEL" | "SPLICE" | "SPLITTER"
  onTabChange: (tab: "PANEL" | "SPLICE" | "SPLITTER") => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  onClose: () => void
}

export function CTOEditorHeader({
  ceoName,
  ceoDescription,
  tab,
  onTabChange,
  fullscreen,
  onToggleFullscreen,
  onClose
}: Props) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{ceoName} (CTO)</div>
        <div style={{ fontSize: 12, color: "#555" }}>{ceoDescription}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          {(["PANEL", "SPLICE", "SPLITTER"] as const).map((t) => (
            <button key={t} onClick={() => onTabChange(t)} style={{ border: "1px solid #ddd", background: tab === t ? "#111" : "#fff", color: tab === t ? "#fff" : "#111", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontWeight: 900 }}>
              {t === "PANEL" ? "Painel CTO" : t === "SPLICE" ? "Fusoes" : "Splitters"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onToggleFullscreen} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>{fullscreen ? "Sair tela cheia" : "Tela cheia"}</button>
        <button onClick={onClose} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>Fechar</button>
      </div>
    </div>
  )
}
