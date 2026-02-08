import { addFiber, getFibers } from "@/data/dataManager";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getFibers());
}

export async function POST(req: Request) {
  const body = await req.json();
  const fiber = addFiber(body);
  return NextResponse.json(fiber);
}