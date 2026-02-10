// components/map/CEOLayer.tsx
import { Marker } from "@react-google-maps/api"
import { CEO } from "@/types/ftth"

type Props = {
  ceos: CEO[]
  onSelectCEO: (ceo: CEO) => void
}

export function CEOLayer({ ceos, onSelectCEO }: Props) {
  function colorByType(tipo: CEO["tipo"]) {
    if (tipo === "CTO") return "#0b5fa5"
    if (tipo === "OLT") return "#22543d"
    if (tipo === "DIO") return "#7c2d12"
    if (tipo === "CLIENTE") return "#4c1d95"
    return "#111"
  }

  return (
    <>
      {ceos.map((c) => (
        <Marker
          key={c.id}
          position={c.position}
          onClick={() => onSelectCEO(c)}
          label={{
            text: c.tipo,
            color: colorByType(c.tipo),
            fontWeight: "700"
          }}
        />
      ))}
    </>
  )
}
