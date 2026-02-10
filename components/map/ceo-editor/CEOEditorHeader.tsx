import React from "react"

type Props = {
  ceoName: string
  ceoDescription: string
  tab: "SPLICE" | "SPLITTER"
  onTabChange: (tab: "SPLICE" | "SPLITTER") => void
  onClose: () => void
}

export function CEOEditorHeader({ ceoName, ceoDescription, tab, onTabChange, onClose }: Props) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{ceoName}</div>
        <div style={{ fontSize: 12, color: "#555" }}>{ceoDescription}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button
            onClick={() => onTabChange("SPLICE")}
            style={{
              border: "1px solid #ddd",
              background: tab === "SPLICE" ? "#111" : "#fff",
              color: tab === "SPLICE" ? "#fff" : "#111",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 900
            }}
          >
            Fusoes
          </button>

          <button
            onClick={() => onTabChange("SPLITTER")}
            style={{
              border: "1px solid #ddd",
              background: tab === "SPLITTER" ? "#111" : "#fff",
              color: tab === "SPLITTER" ? "#fff" : "#111",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 900
            }}
          >
            Splitters
          </button>
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          border: "1px solid #ddd",
          background: "#fff",
          borderRadius: 10,
          padding: "6px 10px",
          cursor: "pointer"
        }}
      >
        Fechar
      </button>
    </div>
  )
}
