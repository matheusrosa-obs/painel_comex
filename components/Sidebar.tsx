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
  produtos: { cd_sh4: string; nm_produto: string; setor: string | null }[];
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
    sh4: string;
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
  const [sh4, setSh4] = useState(current.sh4);

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
    if (sh4 && next) {
      const stillValid = opts.produtos.some(
        (p) => p.cd_sh4 === sh4 && p.setor === next,
      );
      if (!stillValid) setSh4("");
    }
  }

  function apply(next?: {
    tipo?: "exp" | "imp";
    periodos?: string[];
    regioes?: string[];
    pais?: string;
    setor?: string;
    sh4?: string;
  }) {
    const sp = new URLSearchParams(params.toString());
    const merged = {
      tipo,
      periodos,
      regioes,
      pais,
      setor,
      sh4,
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
      sh4: merged.sh4,
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
    setSh4("");
    router.push("/");
  }

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-[var(--border)] bg-[var(--background)]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center gap-4 px-5 py-4">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setTipo("exp");
                apply({ tipo: "exp" });
              }}
              className={`h-9 rounded-md text-sm font-medium transition ${
                tipo === "exp"
                  ? "bg-[var(--accent)] text-[#0b1416]"
                  : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[#3a3a45]"
              }`}
            >
              Exportações
            </button>
            <button
              type="button"
              onClick={() => {
                setTipo("imp");
                apply({ tipo: "imp" });
              }}
              className={`h-9 rounded-md text-sm font-medium transition ${
                tipo === "imp"
                  ? "bg-[var(--accent)] text-[#0b1416]"
                  : "bg-[var(--surface)] text-[var(--foreground)] hover:bg-[#3a3a45]"
              }`}
            >
              Importações
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--muted)]">Seleção de data:</span>
            <DateTreePicker
              anos={opts.anos}
              mesesByAno={opts.mesesByAno}
              selected={periodos}
              onChange={setPeriodos}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--muted)]">Vice-Presidência | Município:</span>
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
            value={sh4}
            onChange={setSh4}
            options={[
              { value: "", label: "Todos os produtos" },
              ...produtosForSetor.map((p) => ({
                value: p.cd_sh4,
                label: `${p.cd_sh4} - ${p.nm_produto}`,
              })),
            ]}
          />

          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => apply()}
              className="h-9 rounded-md bg-[var(--accent)] text-sm font-medium text-[#0b1416] transition hover:brightness-110"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="h-9 rounded-md bg-[var(--surface)] text-sm font-medium text-[var(--foreground)] transition hover:bg-[#3a3a45]"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center px-5 py-4">
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
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--surface)]">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
