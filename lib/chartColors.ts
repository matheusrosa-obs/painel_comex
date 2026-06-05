export const BLUE_STEPS = [
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

export const SECTOR_COLOR_MAP: Record<string, string> = {
  "Alimentos e Bebidas": "#7ee8a2",
  "Agropecuária": "#ff8c42",
  "Papel e Celulose": "#c8e668",
  "Construção": "#7b8cde",
  "Equipamentos Elétricos": "#ffd166",
  "Fármacos": "#4ecdc4",
  "Fumo": "#9b8ea0",
  "Automotivo": "#4a9eff",
  "Cerâmico": "#e07b54",
  "Indústria Diversa": "#52d9a0",
  "Extrativo": "#7da7b8",
  "Indústria Gráfica": "#ff6eb4",
  "Madeira e Móveis": "#c49a6c",
  "Máquinas e Equipamentos": "#ff4f4f",
  "Metalmecânica e Metalurgia": "#45bcd8",
  "Óleo, Gás e Eletricidade": "#ffc233",
  "Produtos Químicos e Plásticos": "#a78bfa",
  "Saneamento Básico": "#40d9b5",
  "Produção Florestal": "#5cb85c",
  "Tecnologia da Informação e Comunicação": "#c084fc",
  "Têxtil, Confecção, Couro e Calçados": "#f9667a",
};

export function sectorColorForLabel(label: string) {
  return SECTOR_COLOR_MAP[label] ?? null;
}

export function blueStepForValue(
  value: number,
  minValue: number,
  maxValue: number,
  strongestForMax = true,
) {
  if (!Number.isFinite(value)) return BLUE_STEPS[BLUE_STEPS.length - 1];
  if (maxValue === minValue) {
    return strongestForMax ? BLUE_STEPS[0] : BLUE_STEPS[BLUE_STEPS.length - 1];
  }
  const t = (value - minValue) / (maxValue - minValue);
  const idx = Math.min(
    BLUE_STEPS.length - 1,
    Math.floor(Math.max(0, t) * BLUE_STEPS.length),
  );
  return strongestForMax
    ? BLUE_STEPS[BLUE_STEPS.length - 1 - idx]
    : BLUE_STEPS[idx];
}
