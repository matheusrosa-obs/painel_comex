/**
 * Databricks SQL Statement Execution REST API client.
 * Uses OAuth M2M (Service Principal) for authentication.
 *
 * Designed for Vercel serverless — no native dependencies, only fetch().
 */

const DATABRICKS_HOST = process.env.DATABRICKS_HOST!;
const DATABRICKS_WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID!;
const DATABRICKS_CLIENT_ID = process.env.DATABRICKS_CLIENT_ID!;
const DATABRICKS_CLIENT_SECRET = process.env.DATABRICKS_CLIENT_SECRET!;

// --- OAuth Token Management ---

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.accessToken;
  }

  const tokenUrl = `https://${DATABRICKS_HOST}/oidc/v1/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: DATABRICKS_CLIENT_ID,
    client_secret: DATABRICKS_CLIENT_SECRET,
    scope: "all-apis",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const expiresIn: number = data.expires_in ?? 3600;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (expiresIn - 60) * 1000, // refresh 60s before expiry
  };

  return cachedToken.accessToken;
}

// --- SQL Statement Execution ---

type StatementStatus = "SUCCEEDED" | "FAILED" | "CANCELED" | "RUNNING" | "PENDING" | "CLOSED";

interface StatementResponse {
  status: { state: StatementStatus; error?: { message: string } };
  manifest?: { schema: { columns: { name: string; type_name: string }[] } };
  result?: { data_array?: unknown[][] };
}

/**
 * Execute a SQL query against the Databricks SQL Warehouse.
 * Returns rows parsed as typed objects.
 */
export async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  waitTimeout = "30s",
): Promise<T[]> {
  const token = await getAccessToken();
  const url = `https://${DATABRICKS_HOST}/api/2.0/sql/statements`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      warehouse_id: DATABRICKS_WAREHOUSE_ID,
      statement: sql,
      wait_timeout: waitTimeout,
      format: "JSON_ARRAY",
      disposition: "INLINE",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL execution request failed (${res.status}): ${text}`);
  }

  const response: StatementResponse = await res.json();

  if (response.status.state === "FAILED") {
    throw new Error(
      `SQL statement failed: ${response.status.error?.message ?? "Unknown error"}`,
    );
  }

  if (response.status.state !== "SUCCEEDED") {
    throw new Error(
      `SQL statement not completed in time (state: ${response.status.state}). Consider increasing wait_timeout.`,
    );
  }

  // Parse columnar response into row objects
  const columns = response.manifest?.schema.columns ?? [];
  const dataArray = response.result?.data_array ?? [];

  return dataArray.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const raw = row[i];
      // Coerce numeric types
      if (
        raw !== null &&
        (col.type_name === "DECIMAL" ||
          col.type_name === "DOUBLE" ||
          col.type_name === "FLOAT" ||
          col.type_name === "INT" ||
          col.type_name === "BIGINT" ||
          col.type_name === "LONG" ||
          col.type_name === "SHORT")
      ) {
        obj[col.name] = Number(raw);
      } else {
        obj[col.name] = raw;
      }
    }
    return obj as T;
  });
}
