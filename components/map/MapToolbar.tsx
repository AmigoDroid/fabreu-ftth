// components/map/MapToolbar.tsx
"use client"

import { useState } from "react"

type Props = {
  setDrawingMode: (mode: google.maps.drawing.OverlayType | null) => void
  setMode: (m: "draw-fiber" | "place-pop" | "place-ceo" | "place-cto" | "place-olt" | "place-dio" | "place-cliente" | null) => void
  mode: "draw-fiber" | "place-pop" | "place-ceo" | "place-cto" | "place-olt" | "place-dio" | "place-cliente" | null
  leftOffset?: number
}

export function MapToolbar({ setDrawingMode, setMode, mode, leftOffset = 336 }: Props) {
  const [open, setOpen] = useState(false)

  const btn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer"
  }

  function modeBtnStyle(active: boolean, activeBg: string): React.CSSProperties {
    return {
      ...btn,
      padding: "8px 10px",
      borderRadius: 8,
      background: active ? activeBg : "#fff",
      color: active ? "#fff" : "#111",
      border: active ? "2px solid #111" : "1px solid #d4dbe7",
      fontWeight: 800,
      textAlign: "left"
    }
  }

  return (
    <div style={{ position: "absolute", top: 58, left: leftOffset, zIndex: 1550, display: "flex", alignItems: "start" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "Recolher ferramentas" : "Abrir ferramentas"}
        style={{
          width: 34,
          height: 42,
          borderRadius: "0 10px 10px 0",
          border: "1px solid #cbd5e1",
          borderLeft: "none",
          background: "#102a56",
          color: "#fff",
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 8px 20px rgba(16,42,86,.25)"
        }}
      >
        {open ? "<" : ">"}
      </button>

      {open && (
        <div
          style={{
            marginLeft: 8,
            width: 210,
            display: "grid",
            gap: 8,
            background: "linear-gradient(170deg,#f7fbff 0%,#fff 70%)",
            border: "1px solid #d8e1ef",
            borderRadius: 10,
            padding: 10,
            boxShadow: "0 12px 28px rgba(15,23,42,.2)"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Ferramentas do mapa</div>

          <button
            style={modeBtnStyle(mode === "draw-fiber", "#111")}
            onClick={() => {
              if (mode !== "draw-fiber") {
                setMode("draw-fiber")
                setDrawingMode(google.maps.drawing.OverlayType.POLYLINE)
                return
              }
              setDrawingMode(null)
              setMode(null)
            }}
            title="Desenhar cabo"
          >
            Desenhar / Salvar cabo
          </button>

          <button
            style={modeBtnStyle(mode === "place-pop", "#102a56")}
            onClick={() => {
              setMode(mode === "place-pop" ? null : "place-pop")
              setDrawingMode(null)
            }}
            title="Clique no mapa para posicionar um POP"
          >
            Inserir POP
          </button>
          <button style={modeBtnStyle(mode === "place-ceo", "#2f6fed")} onClick={() => { setMode(mode === "place-ceo" ? null : "place-ceo"); setDrawingMode(null) }}>
            Inserir CEO
          </button>
          <button style={modeBtnStyle(mode === "place-cto", "#0b5fa5")} onClick={() => { setMode(mode === "place-cto" ? null : "place-cto"); setDrawingMode(null) }}>
            Inserir CTO
          </button>
          <button style={modeBtnStyle(mode === "place-cliente", "#4c1d95")} onClick={() => { setMode(mode === "place-cliente" ? null : "place-cliente"); setDrawingMode(null) }}>
            Inserir Cliente
          </button>

          <button
            style={{ ...btn, padding: "8px 10px", borderRadius: 8, background: "#fff", border: "1px solid #d4dbe7", fontWeight: 700 }}
            onClick={() => {
              setMode(null)
              setDrawingMode(null)
            }}
            title="Cancelar"
          >
            Cancelar modo
          </button>

          {(mode === "place-pop" || mode === "place-ceo" || mode === "place-cto" || mode === "place-cliente") && (
            <div style={{ fontSize: 11, color: "#475569", borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
              {mode === "place-pop"
                ? "Clique em qualquer ponto do mapa para posicionar um POP."
                : `Clique no cabo para posicionar ${mode === "place-ceo" ? "CEO" : mode === "place-cto" ? "CTO" : "Cliente"}.`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

