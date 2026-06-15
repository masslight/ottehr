import Oystehr from '@oystehr/sdk';
import { searchIcd10Codes } from '../icd-10-search';

// ── Easy-chart code validation (the invariant) ──────────────────────────────────────────────────
// No code may reach the note unless the canonical source actually returned it. A model's `code`
// is only a HINT: exact-lookup it, and on a miss fall back to a text search of the display /
// searchTerms and take a real result. A hallucinated or invalid code is therefore corrected (or
// dropped), never charted. Shared by the easy-chart planner (steps) and review (suggestions) so
// both validate identically.

// Anchored, non-global form for validating a single candidate code end-to-end.
export const STRICT_ICD10 = /^[A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?$/;
export const STRICT_CPT = /^\d{4,5}$/; // CPT, incl. E&M 99xxx
export const STRICT_HCPCS = /^[A-V]\d{4}$/; // HCPCS Level II (J-codes, etc.)

// ICD-10 via the canonical local search (same engine the icd-10-search zambda exposes).
export async function resolveIcd(
  suggestedCode: string | undefined,
  display: string,
  searchTerms: string[]
): Promise<{ code: string; display: string } | undefined> {
  const code = suggestedCode?.trim().toUpperCase();
  // 1. Exact-lookup the model's proposed code — the happy path needs no ranking.
  if (code && STRICT_ICD10.test(code)) {
    const byCode = await searchIcd10Codes(code);
    const exact = byCode.find((c) => c.code.toUpperCase() === code);
    if (exact) return { code: exact.code, display: exact.display };
  }
  // 2. Miss → text search by display, then each search term; take the top real result.
  for (const q of [display, ...searchTerms]) {
    if (!q || !q.trim()) continue;
    const res = await searchIcd10Codes(q.trim());
    if (res.length) return { code: res[0].code, display: res[0].display };
  }
  // 3. Nothing valid found — caller drops the code and lets the client picker resolve by display.
  return undefined;
}

// CPT / HCPCS via the Oystehr terminology service.
//   {code,display} → validated;  null → service reachable but code is not real (drop);
//   degraded: service unreachable → keep the model's code rather than silently dropping billing.
export async function resolveCptHcpcs(
  oystehr: Oystehr,
  code: string,
  display: string
): Promise<{ code: string; display: string } | null> {
  const c = code.trim().toUpperCase();
  const isHcpcs = STRICT_HCPCS.test(c);
  const isCpt = STRICT_CPT.test(c);
  if (!isHcpcs && !isCpt) return null; // not a recognizable CPT/HCPCS shape → drop
  try {
    const resp = isHcpcs
      ? await oystehr.terminology.searchHcpcs({ query: c, searchType: 'code', strictMatch: true, limit: 5 })
      : await oystehr.terminology.searchCpt({ query: c, searchType: 'code', strictMatch: true, limit: 5 });
    const exact = (resp.codes ?? []).find((x: { code: string }) => x.code.toUpperCase() === c);
    return exact ? { code: exact.code, display: exact.display } : null; // reachable + not found → drop
  } catch (e) {
    console.warn('easy-chart: CPT/HCPCS terminology unavailable, keeping model code as-is:', e);
    return { code, display }; // degraded: service unreachable → keep the model's code
  }
}
