// components/map/MapToolbar.tsx
type Props = {
  setDrawingMode: (mode: google.maps.drawing.OverlayType | null) => void
  onSave: () => void
  disabledSave: boolean
  setMode: (m: "draw-fiber" | "place-ceo" | null) => void
}

export function MapToolbar({
  setDrawingMode,
  onSave,
  disabledSave,
  setMode
}: Props) {
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
      {/* Desenhar fibra */}
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

      {/* Colocar CEO */}
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
        title="Colocar CEO (emenda)"
      >
        CEO
      </button>

      {/* Salvar edição */}
      <button
        style={btn}
        onClick={onSave}
        disabled={disabledSave}
        title="Salvar edição"
      >
        <img src="/icons/salve.png" width={28} />
      </button>

      {/* Cancelar */}
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