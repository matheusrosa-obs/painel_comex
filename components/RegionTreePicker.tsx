"use client";

import { useMemo } from "react";
import TreePicker, { TreeCheckbox, type TreeGroup } from "./TreePicker";

export const VP_PREFIX = "vp:";
export const MUN_PREFIX = "mun:";

type Props = {
  vps: string[];
  municipiosByVp: Record<string, string[]>;
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function RegionTreePicker({
  vps,
  municipiosByVp,
  selected,
  onChange,
}: Props) {
  const groups = useMemo<TreeGroup[]>(
    () =>
      vps.map((v) => ({
        key: `${VP_PREFIX}${v}`,
        label: v,
        children: (municipiosByVp[v] ?? []).map((m) => ({
          key: `${MUN_PREFIX}${m}`,
          label: m,
        })),
      })),
    [vps, municipiosByVp],
  );

  const todosChecked = selected.length === 0;

  return (
    <TreePicker
      groups={groups}
      selected={selected}
      onChange={onChange}
      maxHeightClass="max-h-[140px]"
      headerRow={
        <TreeCheckbox
          state={todosChecked ? "checked" : "unchecked"}
          label="Todos"
          onClick={() => onChange([])}
          bold
        />
      }
    />
  );
}
