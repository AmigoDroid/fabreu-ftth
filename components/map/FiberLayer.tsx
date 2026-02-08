// components/map/FiberLayer.tsx
import { Polyline, InfoWindow } from "@react-google-maps/api"
import { FiberSegment } from "@/types/ftth"
import { calcularComprimento, getFiberCenter } from "./mapUtils"

type Props = {
  fibers: FiberSegment[]
  selectedFiber: FiberSegment | null
  setSelectedFiber: (f: FiberSegment | null) => void
  polylineRefs: React.MutableRefObject<
    Record<number, google.maps.Polyline>
  >
}

export function FiberLayer({
  fibers,
  selectedFiber,
  setSelectedFiber,
  polylineRefs
}: Props) {
  return (
    <>
      {fibers.map((f) => {
        const isSelected = selectedFiber?.id === f.id

        return (
          <Polyline
            key={f.id}
            path={f.path}
            options={{
              strokeColor: isSelected ? "#00ff00" : "black",
              strokeWeight: isSelected ? 8 : 5,
              editable: isSelected
            }}
            onLoad={(poly) => {
              polylineRefs.current[f.id] = poly
            }}
            onClick={() => setSelectedFiber(f)}
          />
        )
      })}

      {selectedFiber && (
        <InfoWindow
          position={getFiberCenter(selectedFiber.path) as google.maps.LatLngLiteral}
          onCloseClick={() => setSelectedFiber(null)}
        >
          <div>
            <strong>{selectedFiber.nome}</strong>
            <br />
            📏{" "}
            {(calcularComprimento(selectedFiber.path) / 1000).toFixed(2)} km
          </div>
        </InfoWindow>
      )}
    </>
  )
}