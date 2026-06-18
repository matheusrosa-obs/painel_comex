/**
 * SQL query builders for each API endpoint.
 * Builds parameterized queries with WHERE clauses from filters.
 */

import { executeQuery } from "./databricks";

// --- Types ---

export type Filters = {
  periodos?: string[];
  regioes?: string[];
  pais?: string;
  setor?: string;
  produto?: string;
};

export type Tipo = "exp" | "imp";

// --- Table Selection ---

const TABLE_NCM = "devobs.colaborativo.painel_comex_ncm";
const TABLE_MUN = "devobs.colaborativo.painel_comex_mun";

const VP_PREFIX = "vp:";
const MUN_PREFIX = "mun:";

function isRegionalized(f: Filters): boolean {
  return Boolean(f.regioes && f.regioes.length > 0);
}

function getTable(f: Filters): string {
  return isRegionalized(f) ? TABLE_MUN : TABLE_NCM;
}

// --- SQL Escaping ---

function escapeStr(value: string): string {
  return value.replace(/'/g, "''");
}

function inList(values: string[]): string {
  return values.map((v) => `'${escapeStr(v)}'`).join(", ");
}

function inListNum(values: number[]): string {
  return values.join(", ");
}

// --- WHERE Clause Builder ---

function buildWhere(f: Filters): string {
  const conditions: string[] = [];

  // Period filter
  if (f.periodos && f.periodos.length > 0) {
    const years: number[] = [];
    const yearMonths: string[] = [];
    for (const token of f.periodos) {
      const t = token.trim();
      if (/^\d{4}$/.test(t)) years.push(Number(t));
      else if (/^\d{4}-\d{2}$/.test(t)) yearMonths.push(t);
    }
    const parts: string[] = [];
    if (years.length > 0) {
      parts.push(`nr_ano IN (${inListNum(years)})`);
    }
    if (yearMonths.length > 0) {
      parts.push(
        `CONCAT(CAST(nr_ano AS STRING), '-', LPAD(CAST(nr_mes AS STRING), 2, '0')) IN (${inList(yearMonths)})`,
      );
    }
    if (parts.length > 0) {
      conditions.push(`(${parts.join(" OR ")})`);
    }
  }

  // Region filter (municipality table only)
  if (f.regioes && f.regioes.length > 0) {
    const vps: string[] = [];
    const municipios: string[] = [];
    for (const token of f.regioes) {
      const t = token.trim();
      if (t.startsWith(VP_PREFIX)) vps.push(t.slice(VP_PREFIX.length));
      else if (t.startsWith(MUN_PREFIX)) municipios.push(t.slice(MUN_PREFIX.length));
    }
    const parts: string[] = [];
    if (vps.length > 0) {
      parts.push(`nm_vice_presidencia IN (${inList(vps)})`);
    }
    if (municipios.length > 0) {
      parts.push(`nm_municipio IN (${inList(municipios)})`);
    }
    if (parts.length > 0) {
      conditions.push(`(${parts.join(" OR ")})`);
    }
  }

  // Country filter
  if (f.pais) {
    conditions.push(
      `(nm_pais = '${escapeStr(f.pais)}' OR ds_pais = '${escapeStr(f.pais)}')`,
    );
  }

  // Sector filter
  if (f.setor) {
    conditions.push(`nm_sc_competitiva = '${escapeStr(f.setor)}'`);
  }

  // Product filter
  if (f.produto) {
    conditions.push(`nm_produto = '${escapeStr(f.produto)}'`);
  }

  if (conditions.length === 0) return "";
  return "WHERE " + conditions.join(" AND ");
}

function tipoCondition(tipo: Tipo): string {
  if (tipo === "exp") return "(tp_carga LIKE 'EXP%' OR tp_carga = 'E')";
  return "(tp_carga LIKE 'IMP%' OR tp_carga = 'I')";
}

// --- Query Functions ---

/** /api/kpis */
export async function queryKpis(f: Filters) {
  const table = getTable(f);
  const where = buildWhere(f);
  const sql = `
    SELECT
      SUM(CASE WHEN tp_carga LIKE 'EXP%' OR tp_carga = 'E' THEN vl_fob ELSE 0 END) AS exportacoes,
      SUM(CASE WHEN tp_carga LIKE 'IMP%' OR tp_carga = 'I' THEN vl_fob ELSE 0 END) AS importacoes
    FROM ${table}
    ${where}
  `;
  const rows = await executeQuery<{ exportacoes: number; importacoes: number }>(sql);
  const row = rows[0] ?? { exportacoes: 0, importacoes: 0 };
  return {
    exportacoes: row.exportacoes ?? 0,
    importacoes: row.importacoes ?? 0,
    saldo: (row.exportacoes ?? 0) - (row.importacoes ?? 0),
  };
}

/** /api/balance */
export async function queryBalance(f: Filters) {
  const table = getTable(f);
  const where = buildWhere(f);
  const sql = `
    SELECT
      nr_ano,
      nr_mes,
      SUM(CASE WHEN tp_carga LIKE 'EXP%' OR tp_carga = 'E' THEN vl_fob ELSE 0 END) AS exportacoes,
      SUM(CASE WHEN tp_carga LIKE 'IMP%' OR tp_carga = 'I' THEN vl_fob ELSE 0 END) AS importacoes
    FROM ${table}
    ${where}
    GROUP BY nr_ano, nr_mes
    ORDER BY nr_ano, nr_mes
  `;
  const rows = await executeQuery<{
    nr_ano: number;
    nr_mes: number;
    exportacoes: number;
    importacoes: number;
  }>(sql);
  return rows.map((r) => ({
    periodo: `${r.nr_ano}-${String(r.nr_mes).padStart(2, "0")}`,
    exportacoes: r.exportacoes ?? 0,
    importacoes: r.importacoes ?? 0,
    saldo: (r.exportacoes ?? 0) - (r.importacoes ?? 0),
  }));
}

/** /api/countries */
export async function queryCountries(f: Filters, tipo: Tipo, topN?: number) {
  const table = getTable(f);
  const where = buildWhere(f);
  const whereClause = where
    ? `${where} AND ${tipoCondition(tipo)}`
    : `WHERE ${tipoCondition(tipo)}`;
  const limitClause = topN ? `LIMIT ${topN}` : "";
  const sql = `
    SELECT
      nm_pais AS label,
      cd_pais_iso3 AS iso3,
      SUM(vl_fob) AS value
    FROM ${table}
    ${whereClause}
    GROUP BY nm_pais, cd_pais_iso3
    HAVING SUM(vl_fob) > 0
    ORDER BY value DESC
    ${limitClause}
  `;
  return executeQuery<{ label: string; iso3: string | null; value: number }>(sql);
}

/** /api/sectors */
export async function querySectors(f: Filters, tipo: Tipo, topN = 8) {
  const table = getTable(f);
  const where = buildWhere(f);
  const whereClause = where
    ? `${where} AND ${tipoCondition(tipo)}`
    : `WHERE ${tipoCondition(tipo)}`;

  // Get total for share calculation
  const totalSql = `SELECT SUM(vl_fob) AS total FROM ${table} ${whereClause}`;
  const totalRows = await executeQuery<{ total: number }>(totalSql);
  const total = totalRows[0]?.total ?? 0;

  const sql = `
    SELECT
      COALESCE(nm_sc_competitiva, 'Não classificado') AS label,
      SUM(vl_fob) AS value
    FROM ${table}
    ${whereClause}
    GROUP BY nm_sc_competitiva
    ORDER BY value DESC
  `;
  const rows = await executeQuery<{ label: string; value: number }>(sql);

  const head = rows.slice(0, topN);
  const restSum = rows.slice(topN).reduce((s, r) => s + (r.value ?? 0), 0);
  const items = head.map((r) => ({
    label: r.label,
    value: r.value ?? 0,
    share: total ? (r.value ?? 0) / total : 0,
  }));
  if (restSum > 0) {
    items.push({ label: "Outros", value: restSum, share: total ? restSum / total : 0 });
  }
  return { items, total };
}

/** /api/products */
export async function queryProducts(f: Filters, tipo: Tipo, topN = 10) {
  const table = getTable(f);
  const where = buildWhere(f);
  const whereClause = where
    ? `${where} AND ${tipoCondition(tipo)}`
    : `WHERE ${tipoCondition(tipo)}`;
  const sql = `
    SELECT
      COALESCE(nm_produto, 'Não informado') AS label,
      SUM(vl_fob) AS value
    FROM ${table}
    ${whereClause}
    GROUP BY nm_produto
    ORDER BY value DESC
    LIMIT ${topN}
  `;
  return executeQuery<{ label: string; value: number }>(sql);
}

/** /api/filters — returns all filter options */
export async function queryFilters() {
  const [periodRows, paisRows, setorRows, produtoRows, vpMunRows] =
    await Promise.all([
      executeQuery<{ nr_ano: number; nr_mes: number }>(
        `SELECT DISTINCT nr_ano, nr_mes FROM ${TABLE_NCM} ORDER BY nr_ano, nr_mes`,
      ),
      executeQuery<{ ds_pais: string }>(
        `SELECT DISTINCT ds_pais FROM ${TABLE_NCM} WHERE ds_pais IS NOT NULL AND ds_pais != '' ORDER BY ds_pais`,
      ),
      executeQuery<{ nm_sc_competitiva: string }>(
        `SELECT DISTINCT nm_sc_competitiva FROM ${TABLE_NCM} WHERE nm_sc_competitiva IS NOT NULL AND nm_sc_competitiva != '' ORDER BY nm_sc_competitiva`,
      ),
      executeQuery<{ nm_produto: string; nm_sc_competitiva: string | null }>(
        `SELECT DISTINCT nm_produto, nm_sc_competitiva FROM ${TABLE_NCM} WHERE nm_produto IS NOT NULL AND nm_produto != '' ORDER BY nm_produto`,
      ),
      executeQuery<{ nm_vice_presidencia: string; nm_municipio: string }>(
        `SELECT DISTINCT nm_vice_presidencia, nm_municipio FROM ${TABLE_MUN} WHERE nm_vice_presidencia IS NOT NULL ORDER BY nm_vice_presidencia, nm_municipio`,
      ),
    ]);

  // Build anos and mesesByAno
  const mesesByAnoSet: Record<number, Set<number>> = {};
  for (const r of periodRows) {
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

  // Build VPs and municipiosByVp
  const vpsSet = new Set<string>();
  const municipiosByVp: Record<string, string[]> = {};
  for (const r of vpMunRows) {
    const vp = r.nm_vice_presidencia ?? "Sem VP";
    vpsSet.add(vp);
    if (!municipiosByVp[vp]) municipiosByVp[vp] = [];
    if (!municipiosByVp[vp].includes(r.nm_municipio)) {
      municipiosByVp[vp].push(r.nm_municipio);
    }
  }
  const vps = Array.from(vpsSet).sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Products with sector mapping
  const produtos = produtoRows.map((r) => ({
    nm_produto: r.nm_produto,
    setor: r.nm_sc_competitiva ?? null,
  }));

  return {
    anos,
    mesesByAno,
    vps,
    municipiosByVp,
    paises: paisRows.map((r) => r.ds_pais),
    setores: setorRows.map((r) => r.nm_sc_competitiva),
    produtos,
  };
}

// --- URL Parsing (reused from dataset.ts) ---

export function parseFilters(url: URL): Filters {
  const sp = url.searchParams;
  const periodosRaw = sp.get("periodos");
  const periodos = periodosRaw
    ? periodosRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const regioesRaw = sp.get("regioes");
  const regioes = regioesRaw
    ? regioesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  return {
    periodos,
    regioes,
    pais: sp.get("pais") ?? undefined,
    setor: sp.get("setor") ?? undefined,
    produto: sp.get("produto") ?? undefined,
  };
}
