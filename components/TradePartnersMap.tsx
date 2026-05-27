"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { GeoComponent, TooltipComponent } from "echarts/components";
import { ScatterChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { BLUE_STEPS, blueStepForValue } from "@/lib/chartColors";
import { formatFobUSD } from "@/lib/format";

echarts.use([GeoComponent, TooltipComponent, ScatterChart, CanvasRenderer]);

type PartnerItem = { label: string; value: number; iso3?: string | null };

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

// Bubble size tuning knobs.
const BUBBLE_SIZE_MIN = 8;
const BUBBLE_SIZE_MAX = 100;
const BUBBLE_SIZE_EXPONENT = 0.9;

const ANTARCTICA_NAMES = new Set([
  "Antarctica",
  "Antártida",
  "Antartida",
  "Antarctique",
]);

const NAME_ALIASES: Record<string, string> = {
  "Brasil": "Brazil",
  "Estados Unidos": "United States of America",
  "Estados Unidos da América": "United States of America",
  "Rússia": "Russia",
  "Rússia (Federação)": "Russia",
  "Reino Unido": "United Kingdom",
  "Coreia do Sul": "South Korea",
  "Coreia, República da": "South Korea",
  "Vietnã": "Vietnam",
  "República Tcheca": "Czech Republic",
  "República Checa": "Czech Republic",
  "Emirados Árabes Unidos": "United Arab Emirates",
  "África do Sul": "South Africa",
  "Países Baixos": "Netherlands",
  "Holanda": "Netherlands",
  "Alemanha": "Germany",
  "Espanha": "Spain",
  "Itália": "Italy",
  "Japão": "Japan",
  "China": "China",
  "Argentina": "Argentina",
  "Chile": "Chile",
  "Paraguai": "Paraguay",
  "Uruguai": "Uruguay",
  "México": "Mexico",
};

const ISO3_ALIASES: Record<string, string> = {
  BRA: "Brazil",
  USA: "United States of America",
  CHN: "China",
  RUS: "Russia",
  DEU: "Germany",
  ESP: "Spain",
  ITA: "Italy",
  JPN: "Japan",
  KOR: "South Korea",
  MEX: "Mexico",
  ARG: "Argentina",
  CHL: "Chile",
  PRY: "Paraguay",
  URY: "Uruguay",
  GBR: "United Kingdom",
  NLD: "Netherlands",
  ZAF: "South Africa",
  ARE: "United Arab Emirates",
  VNM: "Vietnam",
  CZE: "Czech Republic",
};

type GeoFeature = {
  properties?: { name?: string };
  geometry?: { type?: string; coordinates?: number[][][] | number[][][][] };
};

type GeoJSON = { type: string; features: GeoFeature[] };

type Centroid = [number, number];

function normalizeName(name: string) {
  return NAME_ALIASES[name] ?? name;
}

function normalizeIso3(iso3: string | null | undefined) {
  if (!iso3) return null;
  const key = iso3.trim().toUpperCase();
  return ISO3_ALIASES[key] ?? null;
}

function normalizeKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function polygonCentroid(points: number[][]) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (area === 0) return null;
  const factor = 1 / (3 * area);
  return [cx * factor, cy * factor] as Centroid;
}

function polygonArea(points: number[][]) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function computeCentroids(geoJson: GeoJSON | null) {
  if (!geoJson?.features) return new Map<string, Centroid>();
  const out = new Map<string, Centroid>();

  for (const feature of geoJson.features) {
    const name = feature.properties?.name;
    if (!name || !feature.geometry?.coordinates) continue;
    const coords = feature.geometry.coordinates;

    let best: Centroid | null = null;
    let bestArea = 0;

    if (feature.geometry.type === "Polygon") {
      const rings = coords as number[][][];
      for (const ring of rings) {
        const area = polygonArea(ring);
        if (area > bestArea) {
          const centroid = polygonCentroid(ring);
          if (centroid) {
            best = centroid;
            bestArea = area;
          }
        }
      }
    }

    if (feature.geometry.type === "MultiPolygon") {
      const polygons = coords as number[][][][];
      for (const polygon of polygons) {
        for (const ring of polygon) {
          const area = polygonArea(ring);
          if (area > bestArea) {
            const centroid = polygonCentroid(ring);
            if (centroid) {
              best = centroid;
              bestArea = area;
            }
          }
        }
      }
    }

    if (best) out.set(normalizeKey(name), best);
  }

  return out;
}

function scaleBubble(value: number, maxValue: number) {
  if (!Number.isFinite(value) || maxValue <= 0) return BUBBLE_SIZE_MIN;
  const t = Math.max(0, Math.min(1, value / maxValue));
  return (
    BUBBLE_SIZE_MIN +
    (BUBBLE_SIZE_MAX - BUBBLE_SIZE_MIN) * Math.pow(t, BUBBLE_SIZE_EXPONENT)
  );
}

export default function TradePartnersMap({ tipo, filters }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const centroidRef = useRef<Map<string, Centroid> | null>(null);
  const mapRef = useRef<GeoJSON | null>(null);
  const [items, setItems] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

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
    queueMicrotask(() => setLoading(true));
    fetch(`/api/countries?${queryString}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data: PartnerItem[]) => {
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
    let alive = true;
    fetch("/data/maps/world.json")
      .then((r) => r.json())
      .then((geoJson: GeoJSON) => {
        if (!alive) return;
        mapRef.current = geoJson;
        echarts.registerMap("world", geoJson);
        centroidRef.current = computeCentroids(geoJson);
        setMapReady(true);
      })
      .catch(() => {
        if (alive) setMapReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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
    if (!chart || !mapReady) return;
    if (!items.length) {
      chart.clear();
      return;
    }

    const values = items.map((it) => it.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);

    const data: {
      name: string;
      value: [number, number, number];
      itemStyle: { color: string };
    }[] = [];

    for (const it of items) {
      if (ANTARCTICA_NAMES.has(it.label)) continue;
      const isoName = normalizeIso3(it.iso3);
      const name = normalizeName(isoName ?? it.label);
      const key = normalizeKey(name);
      const coords = centroidRef.current?.get(key);
      if (!coords) continue;
      data.push({
        name: it.label,
        value: [coords[0], coords[1], it.value],
        itemStyle: {
          color: blueStepForValue(it.value, minValue, maxValue, true),
        },
      });
    }

    chart.setOption(
      {
        geo: {
          map: "world",
          roam: false,
          layoutCenter: ["50%", "50%"],
          layoutSize: "200%",
          itemStyle: {
            areaColor: "#494950",
            borderColor: "#3f3f46",
            borderWidth: 0.6,
          },
          emphasis: {
            itemStyle: {
              areaColor: "#2b2b36",
            },
          },
        },
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
            const p = info as { name?: string; value?: [number, number, number] };
            const rawValue = p.value?.[2] ?? 0;
            return [
              `<div style=\"font-weight:500;margin-bottom:4px\">${p.name ?? ""}</div>`,
              `<div>${formatFobUSD(rawValue)}</div>`,
            ].join("");
          },
        },
        series: [
          {
            type: "scatter",
            coordinateSystem: "geo",
            data,
            symbolSize: (val: number[]) => scaleBubble(val[2], maxValue),
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
  }, [items, mapReady]);

  return (
    <div className="relative h-full w-full min-h-[240px]">
      <div ref={containerRef} className="absolute inset-0" />
      {loading && !items.length && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">
          Carregando parceiros...
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
