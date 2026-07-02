import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { searchIcd10Codes } from '../icd-10-search';

// ── Easy-chart code validation (the invariant) ──────────────────────────────────────────────────
// No code may reach the note unless the canonical source actually returned it. A model's `code`
// is only a HINT: exact-lookup it, and on a miss fall back to a text search of the display /
// searchTerms and take a real result. A hallucinated or invalid code is therefore corrected (or
// dropped), never charted. Shared by the easy-chart planner (steps) and review (suggestions) so
// both validate identically.

// Anchored, non-global form for validating a single candidate code end-to-end.
export const STRICT_ICD10 = /^[A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?$/;
// Global, word-bounded scanning counterpart of STRICT_ICD10 for finding code-shaped tokens inside
// narrative text (see sniffers.ts). Keep the two patterns in sync.
export const ICD10_SCAN = /\b([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?)\b/g;
export const STRICT_CPT = /^\d{4,5}$/; // CPT, incl. E&M 99xxx
export const STRICT_HCPCS = /^[A-V]\d{4}$/; // HCPCS Level II (J-codes, etc.)

// ICD-10 via the canonical local search (same engine the icd-10-search zambda exposes).
// Opposing anatomic qualifier pairs. A hinted CODE whose display contradicts the intent's own
// text on one of these (intent says "left upper eyelid", code display says "right lower eyelid")
// is a mis-hint even though the code itself is real — prefer the display-based search instead.
const OPPOSING_QUALIFIERS: Array<[RegExp, RegExp]> = [
  [/\bleft\b/i, /\bright\b/i],
  [/\bupper\b/i, /\blower\b/i],
];
// Coarse anatomy classes for hint/search sanity — a PALM splinter must never resolve to an
// EYELID foreign-body code just because "retained foreign body" matched. Only obviously
// disjoint organ families; anything unlisted imposes no constraint.
const ANATOMY_CLASSES: string[][] = [
  ['eye', 'eyes', 'eyelid', 'ocular', 'conjunctiva', 'cornea', 'orbit'],
  ['ear', 'ears', 'tympanic', 'auditory'],
  ['nose', 'nasal', 'nostril', 'septum'],
  ['hand', 'palm', 'finger', 'fingers', 'thumb', 'wrist'],
  ['foot', 'toe', 'toes', 'ankle', 'heel', 'plantar'],
  ['breast', 'mammary'],
  ['scalp', 'forehead'],
];
const ANATOMY_CLASS_OF = new Map<string, number>();
ANATOMY_CLASSES.forEach((cls, i) => cls.forEach((w) => ANATOMY_CLASS_OF.set(w, i)));
function anatomyClasses(text: string): Set<number> {
  const out = new Set<number>();
  for (const w of text.toLowerCase().split(/[^a-z]+/)) {
    const cls = ANATOMY_CLASS_OF.get(w);
    if (cls !== undefined) out.add(cls);
  }
  return out;
}
function contradictsAnatomy(intentText: string, codeDisplay: string): boolean {
  const a = anatomyClasses(intentText);
  if (a.size === 0) return false;
  const b = anatomyClasses(codeDisplay);
  if (b.size === 0) return false;
  return ![...b].some((c) => a.has(c));
}

function contradictsQualifiers(intentText: string, codeDisplay: string): boolean {
  for (const [a, b] of OPPOSING_QUALIFIERS) {
    if (
      (a.test(intentText) && !a.test(codeDisplay) && b.test(codeDisplay)) ||
      (b.test(intentText) && !b.test(codeDisplay) && a.test(codeDisplay))
    ) {
      return true;
    }
  }
  return false;
}

// Display-overlap sanity: the hinted code's canonical display must share at least one meaningful
// word with the intent's display — a hint of S09.90XA ("Unspecified injury of head") for
// "Concussion without loss of consciousness" is a real code for the WRONG problem, and the
// display-based search below finds the right one (S06.0X0A). Boilerplate coding words don't count.
const CODE_DISPLAY_BOILERPLATE = new Set([
  'with',
  'without',
  'other',
  'unspecified',
  'acute',
  'chronic',
  'initial',
  'subsequent',
  'encounter',
  'sequela',
  'disorder',
  'disease',
  'reaction',
  'effect',
  'syndrome',
  'condition',
  'symptoms',
  'status',
  // Laterality/position words describe WHERE, not WHAT — "Mastitis of right breast" must not
  // pass overlap with "Fibroadenosis of right breast" on the strength of "right"+"breast" alone.
  'right',
  'left',
  'bilateral',
]);
function displaysOverlap(intentText: string, codeDisplay: string): boolean {
  const words = (t: string): Set<string> =>
    new Set(
      t
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 4 && !CODE_DISPLAY_BOILERPLATE.has(w))
    );
  const intentWords = words(intentText);
  if (intentWords.size === 0) return true; // nothing to compare — trust the code
  const codeWords = words(codeDisplay);
  const shared = [...intentWords].filter((w) => [...codeWords].some((c) => c.includes(w) || w.includes(c)));
  // Rich intents (≥3 meaningful words) must share at least TWO — one shared anatomy word
  // ("breast") is how fibroadenosis impersonated mastitis.
  return shared.length >= Math.min(2, intentWords.size);
}

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
    // Laterality/position sanity: a real code can still be the WRONG code — the model once hinted
    // H00.012 (right lower eyelid) for a dictated LEFT UPPER stye. When the hint's display
    // contradicts the intent text on left/right or upper/lower, ignore the hint and let the
    // display-based search below pick the consistent code.
    if (
      exact &&
      !contradictsQualifiers(display, exact.display) &&
      !contradictsAnatomy(display, exact.display) &&
      displaysOverlap(display, exact.display)
    ) {
      return { code: exact.code, display: exact.display };
    }
  }
  // 2. Miss → text search by display, then each search term; take the top non-contradicting result
  //    (the ranking can surface a cross-organ code — "retained foreign body" once returned the
  //    EYELID code for a palm splinter — so anatomy/laterality sanity applies here too).
  for (const q of [display, ...searchTerms]) {
    if (!q || !q.trim()) continue;
    const res = await searchIcd10Codes(q.trim());
    const ok = res.find((r) => !contradictsQualifiers(display, r.display) && !contradictsAnatomy(display, r.display));
    if (ok) return { code: ok.code, display: ok.display };
    if (res.length) return { code: res[0].code, display: res[0].display };
  }
  // 3. Nothing valid found — caller drops the code and lets the client picker resolve by display.
  return undefined;
}

// Apply the invariant to ONE intent record, in place: an ICD hint on add-diagnosis/add-condition
// is resolved (corrected) or deleted; a billing code on set-em-code/add-cpt is exact-validated and
// corrected. Returns 'invalid-billing' when the billing code is definitively not real — the caller
// decides the blast radius (the planner drops just that step; the review drops the whole
// suggestion, since a billing card with a bogus code has no point). Shared so both validate
// identically.
export async function validateIntentCode(
  r: Record<string, unknown>,
  oystehr: Oystehr | undefined
): Promise<'ok' | 'invalid-billing'> {
  if (r.kind === 'add-diagnosis' || r.kind === 'add-condition') {
    const display = typeof r.display === 'string' ? r.display : '';
    const searchTerms = Array.isArray(r.searchTerms)
      ? (r.searchTerms.filter((t) => typeof t === 'string' && !!t.trim()) as string[])
      : [];
    const resolved = await resolveIcd(typeof r.code === 'string' ? r.code : undefined, display, searchTerms);
    if (resolved) r.code = resolved.code;
    else delete r.code; // nothing valid → the client picker resolves by display
  } else if ((r.kind === 'set-em-code' || r.kind === 'add-cpt') && typeof r.code === 'string' && r.code.trim()) {
    if (!oystehr) return 'ok'; // degraded: no client → can't validate, keep as-is
    const resolved = await resolveCptHcpcs(oystehr, r.code, typeof r.display === 'string' ? r.display : '');
    if (resolved === null) return 'invalid-billing';
    r.code = resolved.code;
    if (resolved.display) r.display = resolved.display;
  }
  return 'ok';
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
    // Intentional degrade (don't fail the whole chart over billing-code validation), but it MUST
    // be visible: silently unvalidated billing codes running for days is worse than the outage.
    console.warn('easy-chart: CPT/HCPCS terminology unavailable, keeping model code as-is:', e);
    captureException(e);
    return { code, display }; // degraded: service unreachable → keep the model's code
  }
}
