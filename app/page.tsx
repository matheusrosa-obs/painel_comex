import Sidebar from "@/components/Sidebar";
import { KpiCard } from "@/components/KpiCard";
import { DollarIcon, ExportIcon, ImportIcon } from "@/components/Icons";
import DashboardGrid from "@/components/DashboardGrid";
import { loadFiltered, type Filters } from "@/lib/dataset";
import { kpis, sectorShare } from "@/lib/aggregate";
import { formatFobUSD } from "@/lib/format";

type RawParams = { [key: string]: string | string[] | undefined };

function pickString(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function parsePeriodos(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{4}$/.test(s) || /^\d{4}-\d{2}$/.test(s));
}

function parseRegioes(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("vp:") || s.startsWith("mun:"));
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const tipoRaw = pickString(params.tipo);
  const tipo: "exp" | "imp" = tipoRaw === "imp" ? "imp" : "exp";
  const periodosFromUrl = parsePeriodos(pickString(params.periodos));
  const periodos = periodosFromUrl.length ? periodosFromUrl : ["2026"];
  const regioes = parseRegioes(pickString(params.regioes));
  const pais = pickString(params.pais);
  const setor = pickString(params.setor);
  const produto = pickString(params.produto);

  const filters: Filters = {
    periodos: periodos.length ? periodos : undefined,
    regioes: regioes.length ? regioes : undefined,
    pais: pais || undefined,
    setor: setor || undefined,
    produto: produto || undefined,
  };

  const rows = await loadFiltered(filters);
  const k = kpis(rows);
  const setores = sectorShare(rows, tipo);

  const tipoLabel = tipo === "exp" ? "exportações" : "importações";

  return (
    <div className="flex h-screen w-full">
      <Sidebar
        current={{
          tipo,
          periodos,
          regioes,
          pais,
          setor,
          produto,
        }}
      />

      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
        <header className="flex gap-5">
          <KpiCard
            label="Exportações"
            value={formatFobUSD(k.exportacoes)}
            icon={<ExportIcon />}
          />
          <KpiCard
            label="Importações"
            value={formatFobUSD(k.importacoes)}
            icon={<ImportIcon />}
          />
          <KpiCard
            label="Saldo comercial"
            value={formatFobUSD(k.saldo)}
            icon={<DollarIcon />}
            negative={k.saldo < 0}
          />
        </header>

        <DashboardGrid
          tipo={tipo}
          tipoLabel={tipoLabel}
          treemapItems={setores.items}
          filters={filters}
        />
      </main>
    </div>
  );
}
