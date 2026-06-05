"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DateTreePicker from "./DateTreePicker";
import RegionTreePicker from "./RegionTreePicker";

type FilterOptions = {
  anos: number[];
  mesesByAno: Record<string, number[]>;
  vps: string[];
  municipiosByVp: Record<string, string[]>;
  paises: string[];
  setores: string[];
  produtos: { nm_produto: string; setor: string | null }[];
};

const EMPTY_OPTIONS: FilterOptions = {
  anos: [],
  mesesByAno: {},
  vps: [],
  municipiosByVp: {},
  paises: [],
  setores: [],
  produtos: [],
};

const DEFAULT_PERIODOS = ["2026"];

type SidebarProps = {
  current: {
    tipo: "exp" | "imp";
    periodos: string[];
    regioes: string[];
    pais: string;
    setor: string;
    produto: string;
  };
};

export default function Sidebar({ current }: SidebarProps) {
  const router = useRouter();
  const params = useSearchParams();

  const [opts, setOpts] = useState<FilterOptions>(EMPTY_OPTIONS);
  const [tipo, setTipo] = useState<"exp" | "imp">(current.tipo);
  const [periodos, setPeriodos] = useState<string[]>(current.periodos);
  const [regioes, setRegioes] = useState<string[]>(current.regioes);
  const [pais, setPais] = useState(current.pais);
  const [setor, setSetor] = useState(current.setor);
  const [produto, setProduto] = useState(current.produto);

  useEffect(() => {
    setTipo(current.tipo);
    setPeriodos(current.periodos);
    setRegioes(current.regioes);
    setPais(current.pais);
    setSetor(current.setor);
    setProduto(current.produto);
  }, [
    current.tipo,
    current.periodos,
    current.regioes,
    current.pais,
    current.setor,
    current.produto,
  ]);

  useEffect(() => {
    let alive = true;
    fetch("/api/filters")
      .then((r) => r.json())
      .then((data: FilterOptions) => {
        if (alive) setOpts(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const produtosForSetor = useMemo(() => {
    if (!setor) return opts.produtos;
    return opts.produtos.filter((p) => p.setor === setor);
  }, [setor, opts.produtos]);

  function handleSetorChange(next: string) {
    setSetor(next);
    if (produto && next) {
      const stillValid = opts.produtos.some(
        (p) => p.nm_produto === produto && p.setor === next,
      );
      if (!stillValid) setProduto("");
    }
  }

  function apply(next?: {
    tipo?: "exp" | "imp";
    periodos?: string[];
    regioes?: string[];
    pais?: string;
    setor?: string;
    produto?: string;
  }) {
    const sp = new URLSearchParams(params.toString());
    const merged = {
      tipo,
      periodos,
      regioes,
      pais,
      setor,
      produto,
      ...next,
    };
    if (!merged.periodos || merged.periodos.length === 0) {
      merged.periodos = DEFAULT_PERIODOS;
      setPeriodos(DEFAULT_PERIODOS);
    }
    const scalars: Record<string, string> = {
      tipo: merged.tipo,
      pais: merged.pais,
      setor: merged.setor,
      produto: merged.produto,
    };
    for (const [k, v] of Object.entries(scalars)) {
      if (v && v !== "all" && v !== "") sp.set(k, v);
      else sp.delete(k);
    }
    sp.set("periodos", merged.periodos.join(","));
    if (merged.regioes && merged.regioes.length > 0) sp.set("regioes", merged.regioes.join(","));
    else sp.delete("regioes");
    router.push(`/?${sp.toString()}`);
  }

  function clearAll() {
    setTipo("exp");
    setPeriodos(DEFAULT_PERIODOS);
    setRegioes([]);
    setPais("");
    setSetor("");
    setProduto("");
    router.push("/");
  }

  return (
    <aside className="obs-sidebar">
      <div className="obs-sidebar__scroll">
        <div className="obs-sidebar__inner">
          <div
            className="obs-segmented-control"
            role="group"
            aria-label="Tipo de fluxo"
          >
            <button
              type="button"
              className="obs-segmented-control__item"
              aria-pressed={tipo === "exp"}
              onClick={() => {
                setTipo("exp");
                apply({ tipo: "exp" });
              }}
            >
              Exportações
            </button>
            <button
              type="button"
              className="obs-segmented-control__item"
              aria-pressed={tipo === "imp"}
              onClick={() => {
                setTipo("imp");
                apply({ tipo: "imp" });
              }}
            >
              Importações
            </button>
          </div>

          <div className="obs-filter-field">
            <span className="obs-filter-field__label">Seleção de data:</span>
            <DateTreePicker
              anos={opts.anos}
              mesesByAno={opts.mesesByAno}
              selected={periodos}
              onChange={setPeriodos}
            />
          </div>

          <div className="obs-filter-field">
            <span className="obs-filter-field__label">
              Vice-Presidência | Município:
            </span>
            <RegionTreePicker
              vps={opts.vps}
              municipiosByVp={opts.municipiosByVp}
              selected={regioes}
              onChange={setRegioes}
            />
          </div>

          <FilterSelect
            label="País: Origem | Destino:"
            value={pais}
            onChange={setPais}
            options={[
              { value: "", label: "Todos os países" },
              ...opts.paises.map((p) => ({ value: p, label: p })),
            ]}
          />

          <FilterSelect
            label="Setor econômico:"
            value={setor}
            onChange={handleSetorChange}
            options={[
              { value: "", label: "Todos os setores" },
              ...opts.setores.map((s) => ({ value: s, label: s })),
            ]}
          />

          <FilterSelect
            label="Produto:"
            value={produto}
            onChange={setProduto}
            options={[
              { value: "", label: "Todos os produtos" },
              ...produtosForSetor.map((p) => ({
                value: p.nm_produto,
                label: p.nm_produto,
              })),
            ]}
          />

          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => apply()}
              className="obs-sidebar-button obs-sidebar-button--selected"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="obs-sidebar-button"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="obs-sidebar__footer">
        <Image
          src="/logo.png"
          alt="Observatório FIESC"
          width={160}
          height={48}
          priority
          className="h-auto w-40 object-contain"
        />
      </div>
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="obs-filter-field">
      <span className="obs-filter-field__label">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="obs-filter-dropdown pr-9 focus:border-[var(--obs-color-sky)] focus:outline-none"
        >
          {options.map((o) => (
            <option
              key={o.value}
              value={o.value}
              className="bg-[var(--obs-color-subcontainer)] text-[var(--obs-color-white)]"
            >
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="var(--obs-color-white)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </label>
  );
}
