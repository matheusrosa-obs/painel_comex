import { NextRequest, NextResponse } from "next/server";
import { loadFiltered, parseFilters } from "@/lib/dataset";
import { tradeBalanceSeries } from "@/lib/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const filters = parseFilters(new URL(request.url));
  const rows = await loadFiltered(filters);
  return NextResponse.json(tradeBalanceSeries(rows));
}
