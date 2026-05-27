import { NextResponse } from "next/server";
import { loadMun, loadNcm } from "@/lib/dataset";
import { distinctValues } from "@/lib/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [ncm, mun] = await Promise.all([loadNcm(), loadMun()]);

  const mesesByAnoSet: Record<number, Set<number>> = {};
  for (const r of ncm) {
    const ano = Number(r.nr_ano);
    const mes = Number(r.nr_mes);
    if (!Number.isFinite(ano) || !Number.isFinite(mes)) continue;
    if (!mesesByAnoSet[ano]) mesesByAnoSet[ano] = new Set();
    mesesByAnoSet[ano].add(mes);
  }
  const anos = Object.keys(mesesByAnoSet)
    .map(Number)
    .sort((a, b) => b - a);
  const mesesByAno: Record<string, number[]> = {};
  for (const a of anos) {
    mesesByAno[String(a)] = Array.from(mesesByAnoSet[a]).sort((x, y) => x - y);
  }

  const vps = distinctValues(mun, "nm_vice_presidencia");

  const municipiosByVp: Record<string, string[]> = {};
  for (const r of mun) {
    const vp = r.nm_vice_presidencia ?? "Sem VP";
    if (!municipiosByVp[vp]) municipiosByVp[vp] = [];
    if (!municipiosByVp[vp].includes(r.nm_municipio)) municipiosByVp[vp].push(r.nm_municipio);
  }
  for (const k of Object.keys(municipiosByVp)) {
    municipiosByVp[k].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const paises = distinctValues(ncm, "ds_pais");
  const setores = distinctValues(ncm, "nm_sc_competitiva");

  const produtosMap = new Map<string, { nm_produto: string; setor: string | null }>();
  for (const r of ncm) {
    if (!r.nm_produto) continue;
    if (!produtosMap.has(r.nm_produto)) {
      produtosMap.set(r.nm_produto, {
        nm_produto: r.nm_produto,
        setor: r.nm_sc_competitiva ?? null,
      });
    }
  }
  const produtos = Array.from(produtosMap.entries())
    .map(([, info]) => ({ nm_produto: info.nm_produto, setor: info.setor }))
    .sort((a, b) => a.nm_produto.localeCompare(b.nm_produto, "pt-BR"));

  return NextResponse.json({
    anos,
    mesesByAno,
    vps,
    municipiosByVp,
    paises,
    setores,
    produtos,
  });
}
