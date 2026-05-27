import type { ReactNode } from "react";

type Props = {
  title: string;
  children?: ReactNode;
  fill?: boolean;
};

export function Panel({ title, children, fill }: Props) {
  return (
    <section className="flex min-h-0 flex-col rounded-lg bg-[var(--surface)] p-5">
      <h2 className="text-center text-base font-medium text-[var(--foreground)]">
        {title}
      </h2>
      <div
        className={
          fill
            ? "mt-4 min-h-0 flex-1"
            : "mt-4 flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--muted)]"
        }
      >
        {children}
      </div>
    </section>
  );
}
