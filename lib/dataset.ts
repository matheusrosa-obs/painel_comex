/**
 * Data access layer — delegates to SQL queries with caching.
 * Re-exports types and parseFilters for backward compatibility.
 */

import {
  queryKpis,
  queryBalance,
  queryCountries,
  querySectors,
  queryProducts,
  queryFilters,
  parseFilters,
  type Filters,
  type Tipo,
} from "./queries";
import { cached, filterCacheKey, CACHE_TTL, CACHE_TAGS } from "./cache";

// Re-exports for API route compatibility
export { parseFilters };
export type { Filters, Tipo };

// --- Cached Query Functions ---

export function getCachedKpis(f: Filters) {
  const key = filterCacheKey({
    periodos: f.periodos?.join(","),
    regioes: f.regioes?.join(","),
    pais: f.pais,
    setor: f.setor,
    produto: f.produto,
  });
  return cached(
    () => queryKpis(f),
    ["kpis", key],
    [CACHE_TAGS.DATA],
    CACHE_TTL.DATA,
  )();
}

export function getCachedBalance(f: Filters) {
  const key = filterCacheKey({
    periodos: f.periodos?.join(","),
    regioes: f.regioes?.join(","),
    pais: f.pais,
    setor: f.setor,
    produto: f.produto,
  });
  return cached(
    () => queryBalance(f),
    ["balance", key],
    [CACHE_TAGS.DATA],
    CACHE_TTL.DATA,
  )();
}

export function getCachedCountries(f: Filters, tipo: Tipo, topN?: number) {
  const key = filterCacheKey({
    periodos: f.periodos?.join(","),
    regioes: f.regioes?.join(","),
    pais: f.pais,
    setor: f.setor,
    produto: f.produto,
    tipo,
    topN: topN?.toString(),
  });
  return cached(
    () => queryCountries(f, tipo, topN),
    ["countries", key],
    [CACHE_TAGS.DATA],
    CACHE_TTL.DATA,
  )();
}

export function getCachedSectors(f: Filters, tipo: Tipo, topN?: number) {
  const key = filterCacheKey({
    periodos: f.periodos?.join(","),
    regioes: f.regioes?.join(","),
    pais: f.pais,
    setor: f.setor,
    produto: f.produto,
    tipo,
    topN: topN?.toString(),
  });
  return cached(
    () => querySectors(f, tipo, topN),
    ["sectors", key],
    [CACHE_TAGS.DATA],
    CACHE_TTL.DATA,
  )();
}

export function getCachedProducts(f: Filters, tipo: Tipo, topN?: number) {
  const key = filterCacheKey({
    periodos: f.periodos?.join(","),
    regioes: f.regioes?.join(","),
    pais: f.pais,
    setor: f.setor,
    produto: f.produto,
    tipo,
    topN: topN?.toString(),
  });
  return cached(
    () => queryProducts(f, tipo, topN),
    ["products", key],
    [CACHE_TAGS.DATA],
    CACHE_TTL.DATA,
  )();
}

export function getCachedFilters() {
  return cached(
    () => queryFilters(),
    ["filters-all"],
    [CACHE_TAGS.FILTERS],
    CACHE_TTL.FILTERS,
  )();
}
