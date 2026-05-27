"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Panel } from "@/components/Panel";
import SectorTreemap, { type SectorItem } from "@/components/SectorTreemap";
import ProductsBarChart from "@/components/ProductsBarChart";
import TradePartnersMap from "@/components/TradePartnersMap";

type ClientFilters = {
  periodos?: string[];
  regioes?: string[];
  pais?: string;
  setor?: string;
  produto?: string;
};

type Props = {
  tipo: "exp" | "imp";
  tipoLabel: string;
  treemapItems: SectorItem[];
  filters: ClientFilters;
};

export default function DashboardGrid({
  tipo,
  tipoLabel,
  treemapItems,
  filters,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const selectedSector = filters.setor ?? "";

  const handleSectorSelect = useCallback(
    (label: string) => {
      const sp = new URLSearchParams(params.toString());
      if (label) sp.set("setor", label);
      else sp.delete("setor");
      sp.delete("produto");
      router.push(`/?${sp.toString()}`);
    },
    [params, router],
  );

  return (
    <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-5">
      <Panel
        title={`Participação por setor econômico nas ${tipoLabel}`}
        fill
      >
        <SectorTreemap
          items={treemapItems}
          selectedLabel={selectedSector}
          onSelect={handleSectorSelect}
        />
      </Panel>
      <Panel title="Principais parceiros comerciais" fill>
        <TradePartnersMap tipo={tipo} filters={filters} />
      </Panel>
      <Panel
        title={
          tipo === "exp"
            ? "Principais produtos exportados"
            : "Principais produtos importados"
        }
        fill
      >
        <ProductsBarChart tipo={tipo} filters={filters} />
      </Panel>
      <Panel title="Evolução da balança comercial" />
    </div>
  );
}
