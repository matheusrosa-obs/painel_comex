/**
 * Caching layer for Databricks SQL queries.
 * Uses Next.js unstable_cache with tag-based revalidation.
 */

import { unstable_cache } from "next/cache";

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  /** Filter options: countries, sectors, products, periods, municipalities */
  FILTERS: 24 * 60 * 60, // 24 hours
  /** KPIs & aggregations with specific filter combinations */
  DATA: 60 * 60, // 1 hour
} as const;

// Cache tags for on-demand revalidation
export const CACHE_TAGS = {
  FILTERS: "filters",
  DATA: "data",
} as const;

/**
 * Wrap an async function with Next.js unstable_cache.
 *
 * @param fn - The async function to cache
 * @param keyParts - Unique key parts for this cache entry
 * @param tags - Cache tags for revalidation
 * @param revalidate - TTL in seconds
 */
export function cached<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  tags: string[],
  revalidate: number,
): () => Promise<T> {
  return unstable_cache(fn, keyParts, { tags, revalidate });
}

/**
 * Create a stable cache key from filter parameters.
 * Ensures consistent ordering for cache hits.
 */
export function filterCacheKey(params: Record<string, string | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return sorted || "__no_filters__";
}
