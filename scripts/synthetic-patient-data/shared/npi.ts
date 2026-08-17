// Deterministic, checksum-valid NPI generation. Oystehr validates the NPI
// checksum (Luhn over the 80840-prefixed 9-digit base) on create/update-provider,
// and several EHR zambdas (sign-appointment, create-lab-order, radiology
// create-order, create-update-medication-order) block callers whose Practitioner
// has no NPI (assertPractitionerHasNPI → NOT_AUTHORIZED).

/** Luhn check digit for a 9-digit NPI base, per the NPI 80840 prefix rule. */
export function npiCheckDigit(nineDigits: string): number {
  const full = `80840${nineDigits}`;
  let sum = 0;
  let dbl = true; // rightmost digit doubles first — the check digit is appended
  for (let i = full.length - 1; i >= 0; i--) {
    let d = full.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * A deterministic, checksum-valid 10-digit NPI derived from a stable key (so the
 * same entity always gets the same NPI, and distinct keys get distinct NPIs).
 */
export function makeValidNpi(seedKey: string): string {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) h = Math.imul(h ^ seedKey.charCodeAt(i), 16777619) >>> 0;
  const base = `1${String(h % 100000000).padStart(8, '0')}`; // 9 digits, no leading zero
  return `${base}${npiCheckDigit(base)}`;
}
