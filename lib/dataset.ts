import path from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

export type NcmRow = {
  cd_sh4: string;
  nr_ano: number;
  nr_mes: number;
  tp_carga: string;
  cd_pais: string;
  ds_pais: string;
  vl_fob: number;
  nm_produto: string | null;
  nm_sc_competitiva: string | null;
  ds_cnae_divisao: string | null;
  ds_cnae_grupo: string | null;
};

export type MunRow = NcmRow & {
  cd_municipio: string;
  nm_municipio: string;
  nm_vice_presidencia: string | null;
};

type Loader<T> = () => Promise<T[]>;

function memoize<T>(loader: Loader<T>): Loader<T> {
  let cached: Promise<T[]> | null = null;
  return () => {
    if (!cached) cached = loader();
    return cached;
  };
}

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readParquet<T>(file: string): Promise<T[]> {
  const filename = path.join(DATA_DIR, file);
  const buffer = await asyncBufferFromFile(filename);
  const rows = await parquetReadObjects({ file: buffer, compressors });
  return rows as T[];
}

function normalizeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "bigint") out[k] = Number(v);
    else out[k] = v;
  }
  return out as T;
}

export const loadNcm = memoize<NcmRow>(async () => {
  const rows = await readParquet<NcmRow>("painel_ncm.parquet");
  return rows.map(normalizeRow);
});

export const loadMun = memoize<MunRow>(async () => {
  const rows = await readParquet<MunRow>("painel_mun.parquet");
  return rows.map(normalizeRow);
});

export type Filters = {
  periodos?: string[];
  regioes?: string[];
  pais?: string;
  setor?: string;
  sh4?: string;
};

const VP_PREFIX = "vp:";
const MUN_PREFIX = "mun:";

export function normSh4(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v).padStart(4, "0");
}

export function isRegionalized(f: Filters): boolean {
  return Boolean(f.regioes && f.regioes.length > 0);
}

export function tipoFromCarga(tp: string): "exp" | "imp" | null {
  const t = (tp ?? "").toString().toUpperCase();
  if (t.startsWith("EXP") || t === "E") return "exp";
  if (t.startsWith("IMP") || t === "I") return "imp";
  return null;
}

function buildPeriodMatchers(periodos: string[] | undefined) {
  if (!periodos || periodos.length === 0) return null;
  const years = new Set<number>();
  const yearMonths = new Set<string>();
  for (const token of periodos) {
    const t = token.trim();
    if (!t) continue;
    if (/^\d{4}$/.test(t)) years.add(Number(t));
    else if (/^\d{4}-\d{2}$/.test(t)) yearMonths.add(t);
  }
  if (!years.size && !yearMonths.size) return null;
  return { years, yearMonths };
}

function buildRegionMatchers(regioes: string[] | undefined) {
  if (!regioes || regioes.length === 0) return null;
  const vps = new Set<string>();
  const municipios = new Set<string>();
  for (const token of regioes) {
    const t = token.trim();
    if (!t) continue;
    if (t.startsWith(VP_PREFIX)) vps.add(t.slice(VP_PREFIX.length));
    else if (t.startsWith(MUN_PREFIX)) municipios.add(t.slice(MUN_PREFIX.length));
  }
  if (!vps.size && !municipios.size) return null;
  return { vps, municipios };
}

export function applyFilters<T extends MunRow | NcmRow>(rows: T[], f: Filters): T[] {
  const period = buildPeriodMatchers(f.periodos);
  const region = buildRegionMatchers(f.regioes);
  return rows.filter((r) => {
    if (period) {
      const yr = Number(r.nr_ano);
      const mo = String(Number(r.nr_mes)).padStart(2, "0");
      const ym = `${yr}-${mo}`;
      if (!period.years.has(yr) && !period.yearMonths.has(ym)) return false;
    }
    if (region) {
      if (!("nm_vice_presidencia" in r)) return false;
      const mr = r as MunRow;
      const vp = mr.nm_vice_presidencia ?? "";
      const mun = mr.nm_municipio ?? "";
      if (!region.vps.has(vp) && !region.municipios.has(mun)) return false;
    }
    if (f.pais && r.ds_pais !== f.pais) return false;
    if (f.setor && r.nm_sc_competitiva !== f.setor) return false;
    if (f.sh4 && normSh4(r.cd_sh4) !== f.sh4) return false;
    return true;
  });
}

export async function loadFiltered(f: Filters): Promise<(MunRow | NcmRow)[]> {
  if (isRegionalized(f)) {
    const rows = await loadMun();
    return applyFilters(rows, f);
  }
  const rows = await loadNcm();
  return applyFilters(rows, f);
}

export function parseFilters(url: URL): Filters {
  const sp = url.searchParams;
  const periodosRaw = sp.get("periodos");
  const periodos = periodosRaw
    ? periodosRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const regioesRaw = sp.get("regioes");
  const regioes = regioesRaw
    ? regioesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const sh4Raw = sp.get("sh4");
  return {
    periodos,
    regioes,
    pais: sp.get("pais") ?? undefined,
    setor: sp.get("setor") ?? undefined,
    sh4: sh4Raw ? normSh4(sh4Raw) : undefined,
  };
}
