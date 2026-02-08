import { getClients, addClient } from "@/data/dataManager";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getClients());
}

export async function POST(req: Request) {
  const body = await req.json();
  const client = addClient(body);
  return NextResponse.json(client);
}