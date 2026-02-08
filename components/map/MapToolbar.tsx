// components/map/MapToolbar.tsx
type Props = {
  setDrawingMode: (
    mode: google.maps.drawing.OverlayType | null
  ) => void
  onSave: () => void
  disabledSave: boolean
}

export function MapToolbar({
  setDrawingMode,
  onSave,
  disabledSave
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
      <button
        style={btn}
        onClick={() =>
          setDrawingMode(
            google.maps.drawing.OverlayType.POLYLINE
          )
        }
      >
        <img src="/icons/fibra.png" width={28} />
      </button>

      <button
        style={btn}
        onClick={onSave}
        disabled={disabledSave}
      >
        <img src="/icons/salve.png" width={28} />
      </button>

      <button
        style={btn}
        onClick={() => setDrawingMode(null)}
      >
       Cancelar
      </button>
    </div>
  )
}