"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { TreemapChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { formatFobUSD } from "@/lib/format";

echarts.use([TreemapChart, TooltipComponent, CanvasRenderer]);

type Item = { label: string; value: number; share: number };

const BLUE_STEPS = [
  "#2A4F8B",
  "#355B9A",
  "#4067A9",
  "#4B73B8",
  "#567FC7",
  "#618BD6",
  "#6C97E5",
  "#77A3F4",
  "#84B0FF",
];

type TooltipParams = {
  name: string;
  value: number;
  data?: { share?: number };
};

export default function SectorTreemap({ items }: { items: Item[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

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
    const values = items.map((it) => it.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const colorForValue = (value: number) => {
      if (maxValue === minValue) return BLUE_STEPS[BLUE_STEPS.length - 1];
      const t = (value - minValue) / (maxValue - minValue);
      const idx = Math.min(
        BLUE_STEPS.length - 1,
        Math.floor(t * BLUE_STEPS.length),
      );
      return BLUE_STEPS[BLUE_STEPS.length - 1 - idx];
    };
    const data = items.map((it) => {
      const isTop = it.value === maxValue;
      return {
        name: it.label,
        value: it.value,
        share: it.share,
        itemStyle: {
          color: isTop ? BLUE_STEPS[0] : colorForValue(it.value),
          borderColor: isTop ? "#EAF3FF" : "#1E1E29",
          borderWidth: isTop ? 2 : 0,
        },
      };
    });
    chart.setOption(
      {
        tooltip: {
          trigger: "item",
          backgroundColor: "#2E2E2E",
          borderColor: "#3a3a45",
          borderWidth: 1,
          padding: [8, 12],
          textStyle: {
            color: "#fff",
            fontFamily: "Roboto, system-ui, sans-serif",
            fontSize: 16,
          },
          formatter: (info: unknown) => {
            const p = info as TooltipParams;
            const share = p.data?.share ?? 0;
            return [
              `<div style="font-weight:500;margin-bottom:4px">${p.name}</div>`,
              `<div>${formatFobUSD(p.value)}</div>`,
              `<div style="color:#9ca3af">${(share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}% do total</div>`,
            ].join("");
          },
        },
        series: [
          {
            type: "treemap",
            data,
            left: "2%",
            right: "2%",
            top: "2%",
            bottom: "2%",
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              color: "#ffffff",
              fontSize: 14,
              fontFamily: "Roboto, system-ui, sans-serif",
              formatter: "{b}",
              overflow: "truncate",
            },
            upperLabel: { show: false },
            itemStyle: {
              borderColor: "#1E1E29",
              borderWidth: 0,
              gapWidth: 0,
            },
          },
        ],
      },
      { notMerge: true },
    );
  }, [items]);

  if (!items.length) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">
        Sem dados para os filtros selecionados.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
