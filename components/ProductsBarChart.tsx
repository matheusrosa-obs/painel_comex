"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { BLUE_STEPS, blueStepForValue } from "@/lib/chartColors";
import { formatFobUSD } from "@/lib/format";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

type ProductItem = { label: string; value: number };

type ClientFilters = {
  periodos?: string[];
  regioes?: string[];
  pais?: string;
  setor?: string;
  produto?: string;
};

type Props = {
  tipo: "exp" | "imp";
  filters: ClientFilters;
};

type TooltipParams = {
  name: string;
  value: number;
  data?: { share?: number; rawValue?: number };
};

export default function ProductsBarChart({
  tipo,
  filters,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerClassName = "relative -mt-2 h-full w-full min-h-[240px]";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tipo", tipo);
    if (filters.periodos && filters.periodos.length > 0) {
      params.set("periodos", filters.periodos.join(","));
    }
    if (filters.regioes && filters.regioes.length > 0) {
      params.set("regioes", filters.regioes.join(","));
    }
    if (filters.pais) params.set("pais", filters.pais);
    if (filters.setor) params.set("setor", filters.setor);
    if (filters.produto) params.set("produto", filters.produto);
    return params.toString();
  }, [
    tipo,
    filters.periodos,
    filters.regioes,
    filters.pais,
    filters.setor,
    filters.produto,
  ]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch(`/api/products?${queryString}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: ProductItem[]) => {
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!ac.signal.aborted) setItems([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [queryString]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!items.length) {
      chart.clear();
      return;
    }
    const total = items.reduce((sum, it) => sum + it.value, 0);
    const values = items.map((it) => it.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const data = items.map((it) => {
      const share = total ? it.value / total : 0;
      return {
        name: it.label,
        value: Number((share * 100).toFixed(2)),
        share,
        rawValue: it.value,
        itemStyle: {
          color: blueStepForValue(it.value, minValue, maxValue, true),
        },
      };
    });

    chart.setOption(
      {
        grid: { left: 120, right: 24, top: 8, bottom: 20 },
        tooltip: {
          trigger: "item",
          backgroundColor: "#2E2E2E",
          borderColor: "#3a3a45",
          borderWidth: 1,
          padding: [8, 12],
          textStyle: {
            color: "#fff",
            fontFamily: "Roboto, system-ui, sans-serif",
            fontSize: 12,
          },
          formatter: (info: unknown) => {
            const p = info as TooltipParams;
            const share = p.data?.share ?? 0;
            const rawValue = p.data?.rawValue ?? 0;
            return [
              `<div style=\"font-weight:500;margin-bottom:4px\">${p.name}</div>`,
              `<div>${formatFobUSD(rawValue)}</div>`,
              `<div style=\"color:#9ca3af\">${(share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}% do total</div>`,
            ].join("");
          },
        },
        xAxis: {
          type: "value",
          axisLine: { lineStyle: { color: "#3a3a45" } },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#2b2b36" } },
          axisLabel: {
            color: "#9ca3af",
            fontFamily: "Roboto, system-ui, sans-serif",
            fontSize: 12,
            formatter: (value: number) =>
              `${Number(value).toLocaleString("pt-BR", {
                maximumFractionDigits: 0,
              })}%`,
          },
        },
        yAxis: {
          type: "category",
          inverse: true,
          data: items.map((it) => it.label),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#e5e7eb",
            fontFamily: "Roboto, system-ui, sans-serif",
            fontSize: 14,
            formatter: (value: string) =>
              value.length > 18 ? `${value.slice(0, 18)}...` : value,
          },
        },
        series: [
          {
            type: "bar",
            data,
            barWidth: 20,
            emphasis: {
              itemStyle: {
                color: BLUE_STEPS[0],
              },
            },
          },
        ],
      },
      { notMerge: true },
    );
    chart.resize();
  }, [items]);

  return (
    <div className={containerClassName}>
      <div ref={containerRef} className="absolute inset-0" />
      {loading && !items.length && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">
          Carregando produtos...
        </div>
      )}
      {!loading && !items.length && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">
          Sem dados para os filtros selecionados.
        </div>
      )}
    </div>
  );
}
