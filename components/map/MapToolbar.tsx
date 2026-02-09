// components/map/MapToolbar.tsx
type Props = {
  setDrawingMode: (mode: google.maps.drawing.OverlayType | null) => void
  setMode: (m: "draw-fiber" | "place-ceo" | "place-cto" | null) => void
}

export function MapToolbar({ setDrawingMode, setMode }: Props) {
  const btn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer"
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
        <img src="/icons/fibra.png" width={28} />
      </button>

      <button
        style={{
          ...btn,
          padding: "6px 10px",
          borderRadius: 8,
          background: "#f2f2f2",
          fontWeight: 700
        }}
        onClick={() => {
          setMode("place-ceo")
          setDrawingMode(null)
        }}
        title="Colocar CEO"
      >
        CEO
      </button>

      <button
        style={{
          ...btn,
          padding: "6px 10px",
          borderRadius: 8,
          background: "#e8f5ff",
          fontWeight: 700
        }}
        onClick={() => {
          setMode("place-cto")
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
    </div>
  )
}
