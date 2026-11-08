// WHO / CDC growth-chart math, ported from the OTR-3741 growth-charts report and shared by the get-flowsheet
// zambda (z-scores, percentiles) and the EHR (percentile curves).

/** One LMS table row: [x, L, M, S]; x is age in months, or length in cm for weight-for-length. */
export type LmsRow = [number, number, number, number];

export interface Lms {
  L: number;
  M: number;
  S: number;
}

/** WHO and CDC both turn age in days into months with 365.25 / 12. */
export const DAYS_PER_MONTH = 30.4375;

/** LMS parameters at x, linearly interpolated between the bracketing table rows; undefined outside the table. */
export const lmsAt = (table: LmsRow[], x: number): Lms | undefined => {
  const last = table[table.length - 1];
  if (!(x >= table[0][0] && x <= last[0])) return undefined;
  let i = 1;
  while (i < table.length - 1 && table[i][0] < x) i++;
  const [ax, aL, aM, aS] = table[i - 1];
  const [bx, bL, bM, bS] = table[i];
  const t = (x - ax) / (bx - ax);
  return { L: aL + t * (bL - aL), M: aM + t * (bM - aM), S: aS + t * (bS - aS) };
};

/** The measurement at z-score z (the percentile curves): M (1 + L S z)^(1/L), or M e^(S z) when L = 0. */
export const valueAtZ = (p: Lms, z: number): number =>
  p.L === 0 ? p.M * Math.exp(p.S * z) : p.M * Math.pow(1 + p.L * p.S * z, 1 / p.L);

/**
 * z-score of y. restricted = WHO's rule for weight-based indicators: beyond ±3 SD, distance is measured in
 * units of the 2-to-3 SD gap instead of the LMS curve, so extreme values are not exaggerated.
 */
export const zOf = (p: Lms, y: number, restricted = false): number => {
  const z = p.L === 0 ? Math.log(y / p.M) / p.S : (Math.pow(y / p.M, p.L) - 1) / (p.L * p.S);
  if (!restricted || Math.abs(z) <= 3) return z;
  const sd3 = valueAtZ(p, z > 0 ? 3 : -3);
  const sd2 = valueAtZ(p, z > 0 ? 2 : -2);
  return z > 0 ? 3 + (y - sd3) / (sd3 - sd2) : -3 + (y - sd3) / (sd2 - sd3);
};

/** CDC's modified z-score (used only for its biologically-implausible-value flags). */
export const modifiedZ = (p: Lms, y: number): number =>
  y < p.M ? (y - p.M) / ((p.M - valueAtZ(p, -2)) / 2) : (y - p.M) / ((valueAtZ(p, 2) - p.M) / 2);

/** Standard normal CDF (erf series, accurate to ~1e-10 for |z| <= 5). */
export const normCdf = (z: number): number => {
  if (z <= -5) return 0;
  if (z >= 5) return 1;
  const x = z / Math.SQRT2;
  let term = x;
  let sum = x;
  for (let n = 1; n < 200 && Math.abs(term) > 1e-17; n++) {
    term *= (-x * x) / n;
    sum += term / (2 * n + 1);
  }
  return 0.5 + sum / Math.sqrt(Math.PI);
};

/** The z-score of a percentile (0-100): the inverse of normCdf, by bisection. */
export const zForPercentile = (percentile: number): number => {
  let lo = -5;
  let hi = 5;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < percentile / 100) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const ordinal = (n: number): string => {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};

/** "88th", "<1st", ">99th" — as the growth-charts report shows percentiles. */
export const formatPercentile = (z: number): string => {
  const p = normCdf(z) * 100;
  if (p < 1) return '<1st';
  if (p > 99) return '>99th';
  return ordinal(Math.round(p));
};

/** Clinical age style: "3 d", "12 mo", "4 y 6 mo". */
export const formatAge = (months: number): string => {
  if (months < 1) return `${Math.round(months * DAYS_PER_MONTH)} d`;
  if (months < 24) return `${Math.floor(months)} mo`;
  const y = Math.floor(months / 12);
  const m = Math.floor(months - y * 12);
  return `${y} y${m ? ` ${m} mo` : ''}`;
};
