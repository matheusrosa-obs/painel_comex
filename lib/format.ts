export function formatFobUSD(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "(" : "";
  const close = value < 0 ? ")" : "";
  if (abs >= 1e9) return `${sign}US$ ${(abs / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} bilhões${close}`;
  if (abs >= 1e6) return `${sign}US$ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} milhões${close}`;
  if (abs >= 1e3) return `${sign}US$ ${(abs / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} mil${close}`;
  return `${sign}US$ ${abs.toLocaleString("pt-BR")}${close}`;
}
