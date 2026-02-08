// components/map/CEOLayer.tsx
import { Marker } from "@react-google-maps/api"
import { CEO } from "@/types/ftth"

type Props = {
  ceos: CEO[]
  onSelectCEO: (ceo: CEO) => void
}

export function CEOLayer({ ceos, onSelectCEO }: Props) {
  return (
    <>
      {ceos.map((c) => (
        <Marker
          key={c.id}
          position={c.position}
          onClick={() => onSelectCEO(c)}
          // icon="/icons/ceo.png"
        />
      ))}
    </>
  )
}