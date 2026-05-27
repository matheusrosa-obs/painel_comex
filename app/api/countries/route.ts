import { NextRequest, NextResponse } from "next/server";
import { loadFiltered, parseFilters } from "@/lib/dataset";
import { topCountries } from "@/lib/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") === "imp" ? "imp" : "exp";
  const filters = parseFilters(url);
  const rows = await loadFiltered(filters);
  return NextResponse.json(topCountries(rows, tipo));
}
