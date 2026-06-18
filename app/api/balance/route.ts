import { NextRequest, NextResponse } from "next/server";
import { parseFilters, getCachedBalance } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const filters = parseFilters(new URL(request.url));
  const result = await getCachedBalance(filters);
  return NextResponse.json(result);
}
