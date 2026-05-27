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
