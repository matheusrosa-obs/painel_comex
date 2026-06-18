import { NextResponse } from "next/server";
import { getCachedFilters } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getCachedFilters();
  return NextResponse.json(result);
}
