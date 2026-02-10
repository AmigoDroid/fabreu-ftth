// lib/fakeData.ts
import { Client, FiberSegment } from "@/types/ftth"

export const NETWORK_SEED_JSON: {
  clients: Client[]
  fibers: FiberSegment[]
} = {
  clients: [],
  fibers: []
}

export const clients = NETWORK_SEED_JSON.clients
export const fibers = NETWORK_SEED_JSON.fibers
