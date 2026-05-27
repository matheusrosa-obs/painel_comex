"use client";

import { useMemo, useState, type ReactNode } from "react";

export type TreeGroup = {
  key: string;
  label: string;
  children: { key: string; label: string }[];
};

type Props = {
  groups: TreeGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  maxHeightClass?: string;
  headerRow?: ReactNode;
};

export type TriState = "checked" | "unchecked" | "indeterminate";

function expandSelectionToLeaves(selected: string[], groups: TreeGroup[]): Set<string> {
  const out = new Set<string>();
  const groupByKey = new Map(groups.map((g) => [g.key, g]));
  const leafKeys = new Set<string>();
  for (const g of groups) for (const c of g.children) leafKeys.add(c.key);
  for (const token of selected) {
    const g = groupByKey.get(token);
    if (g) for (const c of g.children) out.add(c.key);
    else if (leafKeys.has(token)) out.add(token);
  }
  return out;
}

function collapseLeavesToTokens(leaves: Set<string>, groups: TreeGroup[]): string[] {
  const tokens: string[] = [];
  for (const g of groups) {
    if (!g.children.length) continue;
    const allSelected = g.children.every((c) => leaves.has(c.key));
    if (allSelected) {
      tokens.push(g.key);
    } else {
      for (const c of g.children) if (leaves.has(c.key)) tokens.push(c.key);
    }
  }
  return tokens;
}

export default function TreePicker({
  groups,
  selected,
  onChange,
  maxHeightClass = "max-h-64",
  headerRow,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selectedLeaves = useMemo(
    () => expandSelectionToLeaves(selected, groups),
    [selected, groups],
  );

  function emit(leaves: Set<string>) {
    onChange(collapseLeavesToTokens(leaves, groups));
  }

  function groupState(g: TreeGroup): TriState {
    if (!g.children.length) return "unchecked";
    const count = g.children.reduce((n, c) => n + (selectedLeaves.has(c.key) ? 1 : 0), 0);
    if (count === 0) return "unchecked";
    if (count === g.children.length) return "checked";
    return "indeterminate";
  }

  function toggleGroup(g: TreeGroup) {
    const next = new Set(selectedLeaves);
    if (groupState(g) === "checked") {
      for (const c of g.children) next.delete(c.key);
    } else {
      for (const c of g.children) next.add(c.key);
    }
    emit(next);
  }

  function toggleLeaf(key: string) {
    const next = new Set(selectedLeaves);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    emit(next);
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex flex-col rounded-md border border-[var(--border)] bg-[var(--surface)]">
      {headerRow && (
        <div className="border-b border-[var(--border)] px-2 py-1">
          {headerRow}
        </div>
      )}
      <div className={`${maxHeightClass} overflow-y-auto px-2 py-1`}>
        {groups.map((g) => {
          const open = expanded[g.key] ?? false;
          return (
            <div key={g.key} className="flex flex-col">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleExpanded(g.key)}
                  aria-label={open ? "Recolher" : "Expandir"}
                  className="grid h-5 w-5 place-items-center text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <Chevron open={open} />
                </button>
                <TreeCheckbox
                  state={groupState(g)}
                  label={g.label}
                  onClick={() => toggleGroup(g)}
                />
              </div>
              {open && (
                <div className="ml-7 flex flex-col">
                  {g.children.map((c) => (
                    <TreeCheckbox
                      key={c.key}
                      state={selectedLeaves.has(c.key) ? "checked" : "unchecked"}
                      label={c.label}
                      onClick={() => toggleLeaf(c.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TreeCheckbox({
  state,
  label,
  onClick,
  bold,
}: {
  state: TriState;
  label: string;
  onClick: () => void;
  bold?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm text-[var(--foreground)] hover:bg-[#3a3a45]"
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
          state === "unchecked"
            ? "border-[#6b7280] bg-transparent"
            : "border-[var(--accent)] bg-[var(--accent)]"
        }`}
      >
        {state === "checked" && (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8.5l3.2 3.2L13 4.5"
              stroke="#0b1416"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {state === "indeterminate" && (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 8h9" stroke="#0b1416" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className={bold ? "font-medium" : undefined}>{label}</span>
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
