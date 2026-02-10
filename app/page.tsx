// app/page.tsx
import Map from "@/components/map/Map"
import { NETWORK_SEED_JSON } from "@/lib/fakeData"

export default function Home() {
  return <Map clients={NETWORK_SEED_JSON.clients} fibers={NETWORK_SEED_JSON.fibers} drawMode={true} />
}
