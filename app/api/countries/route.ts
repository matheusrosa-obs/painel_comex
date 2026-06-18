import { NextRequest, NextResponse } from "next/server";
import { parseFilters, getCachedCountries } from "@/lib/dataset";
import type { Tipo } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tipo: Tipo = url.searchParams.get("tipo") === "imp" ? "imp" : "exp";
  const filters = parseFilters(url);
  const result = await getCachedCountries(filters, tipo);
  return NextResponse.json(result);
}
