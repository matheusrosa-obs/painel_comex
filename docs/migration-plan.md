# Migration Plan: painel_comex → Databricks SQL Connector

## Overview

Migrate the painel_comex Next.js application from reading static local Parquet files to querying the Databricks SQL Warehouse via the REST Statement Execution API, authenticated with OAuth M2M (Service Principal).

**Deploy target:** Vercel  
**Data source:** Databricks SQL Warehouse (Azure)  
**Auth method:** OAuth 2.0 Client Credentials (Service Principal)  

---

## Current Architecture

```
Next.js API Routes
  → lib/dataset.ts (hyparquet reads local .parquet)
  → lib/aggregate.ts (in-memory JS aggregation)
  → JSON response
```

**Data files:**
- `public/data/painel_ncm.parquet` → loaded into memory via `hyparquet`
- `public/data/painel_mun.parquet` → loaded into memory via `hyparquet`

**Flow:** All rows are loaded once (memoized), filtered in JS, aggregated in JS, returned as JSON.

---

## Target Architecture

```
Next.js API Routes (Vercel Serverless Functions)
  → lib/cache.ts (Next.js unstable_cache with TTL)
  → lib/databricks.ts (OAuth token + SQL Statement Execution REST API)
  → Databricks SQL Warehouse
  → devobs.colaborativo.painel_comex_ncm
  → devobs.colaborativo.painel_comex_mun
```

**Flow:** Each API route builds a SQL query with filters/aggregations, executes via REST API, caches results, returns JSON.

---

## Connection Details

| Parameter | Value |
| --- | --- |
| Server hostname | `adb-8191164171225.5.azuredatabricks.net` |
| HTTP path | `/sql/1.0/warehouses/446aea1da9f49b8f` |
| Warehouse ID | `446aea1da9f49b8f` |
| Client ID | `130a83f7-5837-41d0-92f4-7366e339c200` |
| Client Secret | *(stored in .env.local / Vercel env vars)* |
| OAuth token endpoint | `https://adb-8191164171225.5.azuredatabricks.net/oidc/v1/token` |
| SQL API endpoint | `https://adb-8191164171225.5.azuredatabricks.net/api/2.0/sql/statements` |

---

## Tables

| Table | Replaces | Purpose |
| --- | --- | --- |
| `devobs.colaborativo.painel_comex_ncm` | `painel_ncm.parquet` | National-level trade data (by SH4, country, sector) |
| `devobs.colaborativo.painel_comex_mun` | `painel_mun.parquet` | Municipality-level trade data (adds cd_municipio, nm_municipio, nm_vice_presidencia) |

---

## Implementation Steps

### Step 1: Environment Configuration

**Create `.env.local`** (not committed to git):

```env
DATABRICKS_HOST=adb-8191164171225.5.azuredatabricks.net
DATABRICKS_WAREHOUSE_ID=446aea1da9f49b8f
DATABRICKS_CLIENT_ID=130a83f7-5837-41d0-92f4-7366e339c200
DATABRICKS_CLIENT_SECRET=doseafce5f25e6e1d8b69cd26eb83fcb3b21
```

**Update `.gitignore`** — ensure `.env.local` is listed (Next.js does this by default).

**Vercel:** Add the same 4 variables in Vercel Project → Settings → Environment Variables.

---

### Step 2: Create `lib/databricks.ts` — Connection & Query Executor

Responsibilities:
- Obtain and cache OAuth access token (client_credentials grant)
- Refresh token before expiry (buffer of 60s)
- Execute SQL statements via the Statement Execution REST API
- Parse columnar response into typed row objects
- Handle errors and retries (warehouse cold-start can take a few seconds)

**OAuth M2M flow:**
```
POST https://{host}/oidc/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={DATABRICKS_CLIENT_ID}
&client_secret={DATABRICKS_CLIENT_SECRET}
&scope=all-apis
```

Returns: `{ access_token, token_type, expires_in }`

**SQL execution:**
```
POST https://{host}/api/2.0/sql/statements
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "warehouse_id": "{DATABRICKS_WAREHOUSE_ID}",
  "statement": "SELECT ...",
  "wait_timeout": "30s",
  "format": "JSON_ARRAY",
  "disposition": "INLINE"
}
```

Returns: `{ status, manifest (column names/types), result (data_array) }`

**Exported interface:**
```typescript
export async function executeQuery<T>(sql: string): Promise<T[]>
```

---

### Step 3: Create `lib/cache.ts` — Caching Layer

Uses Next.js `unstable_cache` with tag-based revalidation.

**Cache tiers:**

| Data type | TTL | Cache tag | Rationale |
| --- | --- | --- | --- |
| Filter options (países, setores, produtos, períodos, municípios) | 24 hours | `filters` | Rarely change; called on every page load |
| KPIs & aggregations (with specific filter combo) | 1 hour | `data` | Changes when underlying data refreshes |
| OAuth token | token expiry - 60s | *(in-memory, not disk)* | Avoid re-auth per request |

**On-demand revalidation (optional future):**  
Create an API route `app/api/revalidate/route.ts` that calls `revalidateTag('data')` and `revalidateTag('filters')`. Trigger after data pipeline completes.

**Exported interface:**
```typescript
export function cached<T>(fn: () => Promise<T>, tags: string[], ttl: number): () => Promise<T>
```

---

### Step 4: Create `lib/queries.ts` — SQL Query Builders

Each function builds a parameterized SQL string with WHERE clauses based on filters.

**Base filter logic (shared across queries):**

```sql
WHERE 1=1
  AND (nr_ano IN (...) OR CONCAT(nr_ano, '-', LPAD(nr_mes, 2, '0')) IN (...))
  AND nm_pais = '...'
  AND nm_sc_competitiva = '...'
  AND nm_produto = '...'
  -- Municipality table only:
  AND (nm_vice_presidencia IN (...) OR nm_municipio IN (...))
```

**Queries per endpoint:**

#### `/api/kpis`
```sql
SELECT
  SUM(CASE WHEN tp_carga LIKE 'EXP%' OR tp_carga = 'E' THEN vl_fob ELSE 0 END) AS exportacoes,
  SUM(CASE WHEN tp_carga LIKE 'IMP%' OR tp_carga = 'I' THEN vl_fob ELSE 0 END) AS importacoes
FROM {table}
{WHERE}
```
App computes `saldo = exportacoes - importacoes`.

#### `/api/balance`
```sql
SELECT
  nr_ano,
  nr_mes,
  SUM(CASE WHEN tp_carga LIKE 'EXP%' OR tp_carga = 'E' THEN vl_fob ELSE 0 END) AS exportacoes,
  SUM(CASE WHEN tp_carga LIKE 'IMP%' OR tp_carga = 'I' THEN vl_fob ELSE 0 END) AS importacoes
FROM {table}
{WHERE}
GROUP BY nr_ano, nr_mes
ORDER BY nr_ano, nr_mes
```

#### `/api/countries`
```sql
SELECT
  nm_pais AS label,
  cd_pais_iso3 AS iso3,
  SUM(vl_fob) AS value
FROM {table}
{WHERE}
  AND (tp_carga LIKE 'EXP%' OR tp_carga = 'E')  -- or IMP based on ?tipo param
GROUP BY nm_pais, cd_pais_iso3
ORDER BY value DESC
LIMIT {topN}
```

#### `/api/sectors`
```sql
SELECT
  COALESCE(nm_sc_competitiva, 'Não classificado') AS label,
  SUM(vl_fob) AS value
FROM {table}
{WHERE}
  AND (tp_carga LIKE 'EXP%' OR tp_carga = 'E')  -- or IMP
GROUP BY nm_sc_competitiva
ORDER BY value DESC
LIMIT {topN}
```

#### `/api/products`
```sql
SELECT
  COALESCE(nm_produto, 'Não informado') AS label,
  SUM(vl_fob) AS value
FROM {table}
{WHERE}
  AND (tp_carga LIKE 'EXP%' OR tp_carga = 'E')  -- or IMP
GROUP BY nm_produto
ORDER BY value DESC
LIMIT {topN}
```

#### `/api/filters`
```sql
-- Distinct periods
SELECT DISTINCT nr_ano, nr_mes FROM {table} ORDER BY nr_ano, nr_mes;

-- Distinct countries
SELECT DISTINCT nm_pais FROM {table} WHERE nm_pais IS NOT NULL ORDER BY nm_pais;

-- Distinct sectors
SELECT DISTINCT nm_sc_competitiva FROM {table} WHERE nm_sc_competitiva IS NOT NULL ORDER BY nm_sc_competitiva;

-- Distinct products
SELECT DISTINCT nm_produto FROM {table} WHERE nm_produto IS NOT NULL ORDER BY nm_produto;

-- Distinct municipalities / VPs (from mun table only)
SELECT DISTINCT nm_vice_presidencia, nm_municipio FROM devobs.colaborativo.painel_comex_mun
WHERE nm_vice_presidencia IS NOT NULL ORDER BY nm_vice_presidencia, nm_municipio;
```

**Table selection logic:**
- If filters include `regioes` (VP or municipality) → use `painel_comex_mun`
- Otherwise → use `painel_comex_ncm`

---

### Step 5: Update API Routes

Each route keeps its current URL interface. Internal changes:

```typescript
// Before:
const rows = await loadFiltered(filters);
return NextResponse.json(kpis(rows));

// After:
const result = await cachedKpis(filters);
return NextResponse.json(result);
```

The `route.ts` files remain thin — they parse params and delegate.

---

### Step 6: Update `package.json`

**Remove:**
- `hyparquet`
- `hyparquet-compressors`

**Add:** Nothing — the implementation uses only built-in `fetch()` (available in Node.js 18+ / Vercel runtime).

---

### Step 7: Cleanup

**Delete files:**
- `public/data/painel_ncm.parquet`
- `public/data/painel_mun.parquet`
- `lib/aggregate.ts`

**Remove from `.gitignore`** (if present):
- Any references to `public/data/` that are no longer needed

---

## File Summary

| File | Action |
| --- | --- |
| `.env.local` | Create |
| `lib/databricks.ts` | Create |
| `lib/cache.ts` | Create |
| `lib/queries.ts` | Create |
| `lib/dataset.ts` | Rewrite (thin wrapper, delegates to queries + cache) |
| `app/api/kpis/route.ts` | Update |
| `app/api/balance/route.ts` | Update |
| `app/api/countries/route.ts` | Update |
| `app/api/sectors/route.ts` | Update |
| `app/api/products/route.ts` | Update |
| `app/api/filters/route.ts` | Update |
| `package.json` | Update (remove deps) |
| `public/data/painel_ncm.parquet` | Delete |
| `public/data/painel_mun.parquet` | Delete |
| `lib/aggregate.ts` | Delete |

---

## Security Considerations

1. **Never commit secrets** — `.env.local` must stay in `.gitignore`
2. **SQL injection** — All filter values must be escaped/sanitized before interpolation into SQL strings. Use allowlists where possible (e.g., `tipo` can only be `'exp'` or `'imp'`)
3. **Service Principal scope** — Ensure the SP (`130a83f7-...`) has only `SELECT` access to `devobs.colaborativo.painel_comex_ncm` and `devobs.colaborativo.painel_comex_mun`
4. **Warehouse auto-stop** — The SQL warehouse may be stopped; the first request after inactivity will have a cold-start delay (~10-30s). Consider keeping the warehouse "always on" or implementing a loading state in the frontend

---

## Testing Checklist

- [ ] OAuth token acquisition works with provided credentials
- [ ] Simple SELECT against both tables returns data
- [ ] KPIs match previous Parquet-based results
- [ ] Filter combinations work (períodos, regiões, país, setor, produto)
- [ ] Cache invalidation works (tag-based revalidation)
- [ ] Cold warehouse start is handled gracefully (retry or loading state)
- [ ] Vercel deploy succeeds (no native dep issues)
- [ ] Environment variables configured in Vercel dashboard

---

## Rollback Plan

If issues arise, revert by:
1. Restoring `public/data/*.parquet` files
2. Restoring `lib/aggregate.ts` and original `lib/dataset.ts`
3. Re-adding `hyparquet` / `hyparquet-compressors` to `package.json`
4. Reverting API route changes

Keep the Parquet files in version control (or a separate branch) until the migration is validated in production.
