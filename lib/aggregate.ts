import type { MunRow, NcmRow } from "./dataset";
import { tipoFromCarga } from "./dataset";

type Row = MunRow | NcmRow;

export function kpis(rows: Row[]) {
  let exp = 0;
  let imp = 0;
  for (const r of rows) {
    const tipo = tipoFromCarga(r.tp_carga);
    const v = Number(r.vl_fob) || 0;
    if (tipo === "exp") exp += v;
    else if (tipo === "imp") imp += v;
  }
  return { exportacoes: exp, importacoes: imp, saldo: exp - imp };
}

function topNBy<T>(map: Map<string, number>, n: number): { label: string; value: number }[] {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export function sectorShare(rows: Row[], tipo: "exp" | "imp", topN = 8) {
  const agg = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (tipoFromCarga(r.tp_carga) !== tipo) continue;
    const key = r.nm_sc_competitiva || "Não classificado";
    const v = Number(r.vl_fob) || 0;
    agg.set(key, (agg.get(key) ?? 0) + v);
    total += v;
  }
  const sorted = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, topN);
  const restSum = sorted.slice(topN).reduce((s, [, v]) => s + v, 0);
  const items = head.map(([label, value]) => ({ label, value, share: total ? value / total : 0 }));
  if (restSum > 0) items.push({ label: "Outros", value: restSum, share: total ? restSum / total : 0 });
  return { items, total };
}

export function topCountries(rows: Row[], tipo: "exp" | "imp", topN = 10) {
  const agg = new Map<string, number>();
  for (const r of rows) {
    if (tipoFromCarga(r.tp_carga) !== tipo) continue;
    const key = r.ds_pais || "Não informado";
    agg.set(key, (agg.get(key) ?? 0) + (Number(r.vl_fob) || 0));
  }
  return topNBy(agg, topN);
}

export function topProducts(rows: Row[], tipo: "exp" | "imp", topN = 10) {
  const agg = new Map<string, number>();
  for (const r of rows) {
    if (tipoFromCarga(r.tp_carga) !== tipo) continue;
    const key = r.nm_produto || r.cd_sh4 || "Não informado";
    agg.set(key, (agg.get(key) ?? 0) + (Number(r.vl_fob) || 0));
  }
  return topNBy(agg, topN);
}

export function tradeBalanceSeries(rows: Row[]) {
  const byMonth = new Map<string, { exp: number; imp: number }>();
  for (const r of rows) {
    const tipo = tipoFromCarga(r.tp_carga);
    if (!tipo) continue;
    const ano = Number(r.nr_ano);
    const mes = Number(r.nr_mes);
    const key = `${ano}-${String(mes).padStart(2, "0")}`;
    const acc = byMonth.get(key) ?? { exp: 0, imp: 0 };
    const v = Number(r.vl_fob) || 0;
    if (tipo === "exp") acc.exp += v;
    else acc.imp += v;
    byMonth.set(key, acc);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([periodo, { exp, imp }]) => ({ periodo, exportacoes: exp, importacoes: imp, saldo: exp - imp }));
}

export function distinctValues(
  rows: Row[],
  key: keyof MunRow,
): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = (r as Record<string, unknown>)[key as string];
    if (v != null && v !== "") set.add(String(v));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
