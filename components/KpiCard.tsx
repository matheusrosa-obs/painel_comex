import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  icon: ReactNode;
  negative?: boolean;
};

export function KpiCard({ label, value, icon, negative }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg bg-[var(--surface)] px-5 py-3">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="text-[var(--accent)]">{icon}</span>
        <span>{label}</span>
      </div>
      <div
        className={`text-2xl font-medium ${negative ? "text-[var(--foreground)]" : "text-[var(--foreground)]"}`}
      >
        {value}
      </div>
    </div>
  );
}
