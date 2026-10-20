export const MAX_PLAUSIBLE_LENGTH_CM = 100;

export const isPlausibleLengthCm = (value: number | undefined): boolean =>
  value !== undefined && Number.isFinite(value) && value > 0 && value <= MAX_PLAUSIBLE_LENGTH_CM;
