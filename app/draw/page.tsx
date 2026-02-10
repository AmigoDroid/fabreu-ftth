import Map from "@/components/map/Map"
import { NETWORK_SEED_JSON } from "@/lib/fakeData"

export default function DrawPage() {
  return (<>
  <h1>Modo Desenho</h1>
  <Map clients={NETWORK_SEED_JSON.clients} fibers={NETWORK_SEED_JSON.fibers} drawMode />
  </>);
}
