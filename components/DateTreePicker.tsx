"use client";

import { useMemo } from "react";
import TreePicker, { type TreeGroup } from "./TreePicker";

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

type Props = {
  anos: number[];
  mesesByAno: Record<string, number[]>;
  selected: string[];
  onChange: (next: string[]) => void;
};

export default function DateTreePicker({ anos, mesesByAno, selected, onChange }: Props) {
  const groups = useMemo<TreeGroup[]>(
    () =>
      anos.map((a) => ({
        key: String(a),
        label: String(a),
        children: (mesesByAno[String(a)] ?? []).map((m) => ({
          key: `${a}-${String(m).padStart(2, "0")}`,
          label: MONTH_NAMES[m - 1],
        })),
      })),
    [anos, mesesByAno],
  );

  return (
    <TreePicker
      groups={groups}
      selected={selected}
      onChange={onChange}
      maxHeightClass="max-h-[140px]"
    />
  );
}
