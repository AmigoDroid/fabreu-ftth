import Map from "@/components/map/Map"
import { clients, fibers } from "@/lib/fakeData"

export default function DrawPage() {
  return (<>
  <h1>Modo Desenho</h1>
  <Map clients={clients} fibers={fibers} drawMode />
  </>);
}