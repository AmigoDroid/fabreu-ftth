// components/map/MapToolbar.tsx
type Props = {
  setDrawingMode: (mode: google.maps.drawing.OverlayType | null) => void
  setMode: (m: "draw-fiber" | "place-ceo" | "place-cto" | null) => void
  mode: "draw-fiber" | "place-ceo" | "place-cto" | null
}

export function MapToolbar({ setDrawingMode, setMode, mode }: Props) {
  const btn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer"
  }

  function modeBtnStyle(active: boolean, activeBg: string): React.CSSProperties {
    return {
      ...btn,
      padding: "6px 10px",
      borderRadius: 8,
      background: active ? activeBg : "#fff",
      color: active ? "#fff" : "#111",
      border: active ? "2px solid #111" : "1px solid #ddd",
      fontWeight: 800,
      boxShadow: active ? "0 0 0 2px rgba(17,17,17,0.12)" : "none",
      transform: active ? "translateY(-1px)" : "none"
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 999,
        display: "flex",
        gap: 10,
        background: "#fff",
        padding: 10,
        borderRadius: 10
      }}
    >
      <button
        style={btn}
        onClick={() => {
          setMode("draw-fiber")
          setDrawingMode(google.maps.drawing.OverlayType.POLYLINE)
        }}
        title="Desenhar fibra"
      >
        <img src="/icons/fibra.png" width={28} alt="Desenhar fibra" />
      </button>

      <button
        style={modeBtnStyle(mode === "draw-fiber", "#111")}
        onClick={() => {
          if (mode !== "draw-fiber") {
            setMode("draw-fiber")
            setDrawingMode(google.maps.drawing.OverlayType.POLYLINE)
            return
          }
          // Finaliza o desenho atual para abrir o popup de salvar.
          setDrawingMode(null)
          setMode(null)
        }}
        title="Finalizar e salvar cabo"
      >
        Salvar cabo
      </button>

      <button
        style={modeBtnStyle(mode === "place-ceo", "#2f6fed")}
        onClick={() => {
          setMode(mode === "place-ceo" ? null : "place-ceo")
          setDrawingMode(null)
        }}
        title="Colocar CEO"
      >
        CEO
      </button>

      <button
        style={modeBtnStyle(mode === "place-cto", "#0b5fa5")}
        onClick={() => {
          setMode(mode === "place-cto" ? null : "place-cto")
          setDrawingMode(null)
        }}
        title="Colocar CTO"
      >
        CTO
      </button>

      <button
        style={{
          ...btn,
          padding: "6px 10px",
          borderRadius: 8,
          background: "#fff",
          border: "1px solid #ddd"
        }}
        onClick={() => {
          setMode(null)
          setDrawingMode(null)
        }}
        title="Cancelar"
      >
        Cancelar
      </button>

      {(mode === "place-ceo" || mode === "place-cto") && (
        <div
          style={{
            marginLeft: 4,
            alignSelf: "center",
            fontSize: 12,
            color: "#333",
            fontWeight: 700
          }}
        >
          Modo ativo: clique no cabo para adicionar {mode === "place-ceo" ? "CEO" : "CTO"}.
        </div>
      )}
    </div>
  )
}
