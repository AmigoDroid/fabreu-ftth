import { Marker, InfoWindow } from "@react-google-maps/api"
import { Client } from "@/types/ftth"
import { useState } from "react"

type Props = {
  clients: Client[]
}

export function ClientLayer({ clients }: Props) {
  const [selected, setSelected] =
    useState<Client | null>(null)

  return (
    <>
      {clients.map((c) => (
        <Marker
          key={c.id}
          position={c.position}
          onClick={() => setSelected(c)}
        />
      ))}

      {selected && (
        <InfoWindow
          position={selected.position}
          onCloseClick={() => setSelected(null)}
        >
          <div>
            <strong>{selected.nome}</strong>
            <br />
            RX: {selected.rx} dBm
          </div>
        </InfoWindow>
      )}
    </>
  )
}