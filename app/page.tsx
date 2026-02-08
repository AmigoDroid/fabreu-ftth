// app/page.tsx
import Map from "@/components/map/Map"
import { clients, fibers } from "@/lib/fakeData"

export default function Home() {
  return <Map clients={clients} fibers={fibers} drawMode={true} />
}