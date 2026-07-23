import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { createTerminologyIcdSearch, EXPLICIT_HISTORY_INTENT, IcdSearchFn, wordMatchesDisplay } from './icd-search';

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

// ICD-10 via the Oystehr terminology service (the same platform search the EHR picker uses),
// threaded into the resolution functions as an injected IcdSearchFn (see icd-search.ts) so the
// guards stay pure and tests run against deterministic fixtures.
// Mutually exclusive qualifier groups. A hinted CODE whose display sits in a DIFFERENT member of
// a group than the intent's own text (intent says "left upper eyelid", code display says "right
// lower eyelid"; intent says "right index finger", code display says "right thumb") is a mis-hint
// even though the code itself is real — prefer the display-based search instead. A contradiction
// requires both texts to name a member and NO member to match both, so a text naming several
// members ("thumb and index finger") never contradicts a code for any of them.
const OPPOSING_QUALIFIER_GROUPS: RegExp[][] = [
  [/\bleft\b/i, /\bright\b/i],
  [/\bupper\b/i, /\blower\b/i],
  // Digits are disjoint sites ICD partitions into sibling codes (S61.01x thumb vs S61.21x other
  // finger). A "right index finger" laceration display once charted the right-THUMB code: same
  // anatomy class, same S6 block, and display overlap carried by "laceration"+"foreign"+"body",
  // so only a digit-level opposition catches it.
  [
    /\bthumb\b/i,
    /\b(?:index|pointer)\s+finger/i,
    /\bmiddle\s+finger/i,
    /\bring\s+finger/i,
    /\b(?:little|pinky|fifth)\s+finger/i,
  ],
  // Wound types are sibling partitions of the same injury categories (S61.21x laceration vs
  // S61.23x puncture wound): a "Laceration of right index finger" display once carried the
  // PUNCTURE code past the overlap check on shared site words alone.
  [/\blacerat/i, /\bpuncture\b/i, /\bbite\b/i],
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

// ICD-10 injury codes (S-chapter) are partitioned by body region in the digit after the S:
// S0x head, S1x neck, S2x thorax, S3x abdomen/lower back/pelvis, S4x shoulder/upper arm,
// S5x elbow/forearm, S6x wrist/hand, S7x hip/thigh, S8x knee/lower leg, S9x ankle/foot. When the
// intent's own text names a site, a code from a different block is the wrong body region even
// though the code is real and the injury word matches — a head-block contusion code once attached
// to a dictated TAILBONE contusion because "contusion" matched and no anatomy class covered the
// trunk. Conservative, unambiguous site words only; multi-word entries are matched as substrings
// of the whole text. Text naming no listed site imposes no constraint.
const S_BLOCK_SITE_WORDS: string[][] = [
  [
    'head',
    'scalp',
    'skull',
    'face',
    'facial',
    'ear',
    'eye',
    'eyes',
    'eyelid',
    'orbit',
    'nose',
    'nasal',
    'cheek',
    'jaw',
    'chin',
    'lip',
    'lips',
    'forehead',
    'temple',
    'mouth',
    'tongue',
  ], // S00–S09
  ['neck', 'cervical', 'throat', 'larynx', 'pharynx', 'trachea'], // S10–S19
  ['thorax', 'thoracic', 'chest', 'rib', 'ribs', 'sternum', 'breast'], // S20–S29
  [
    'abdomen',
    'abdominal',
    'lumbar',
    'lower back',
    'pelvis',
    'pelvic',
    'coccyx',
    'coccygeal',
    'tailbone',
    'sacrum',
    'sacral',
    'buttock',
    'buttocks',
    'groin',
    'flank',
  ], // S30–S39
  ['shoulder', 'clavicle', 'collarbone', 'scapula', 'axilla', 'armpit', 'upper arm', 'humerus'], // S40–S49
  ['elbow', 'forearm', 'radius', 'ulna'], // S50–S59
  ['wrist', 'hand', 'finger', 'fingers', 'thumb', 'palm'], // S60–S69
  ['hip', 'thigh', 'femur', 'femoral'], // S70–S79
  ['knee', 'kneecap', 'patella', 'lower leg', 'calf', 'shin', 'tibia', 'fibula'], // S80–S89
  ['ankle', 'foot', 'heel', 'toe', 'toes', 'metatarsal'], // S90–S99
];
function injuryRegionsIn(text: string): Set<number> {
  const lower = text.toLowerCase();
  const words = new Set(lower.split(/[^a-z]+/));
  const out = new Set<number>();
  S_BLOCK_SITE_WORDS.forEach((siteWords, block) => {
    if (siteWords.some((w) => (w.includes(' ') ? lower.includes(w) : words.has(w)))) out.add(block);
  });
  return out;
}
// Exported for direct unit tests of the guard's word lists.
export function contradictsInjuryRegion(intentText: string, code: string): boolean {
  const block = /^S([0-9])/.exec(code.trim().toUpperCase());
  if (!block) return false; // not an injury code → no block constraint
  const intentRegions = injuryRegionsIn(intentText);
  if (intentRegions.size === 0) return false;
  return !intentRegions.has(Number(block[1]));
}

// Asymptomatic history/status Z-codes (Z80–Z87 personal/family history, Z93–Z99 status) read like
// active problems lexically — "history of recurrent ingrown hairs" once charted Z87.01 "Personal
// history of pneumonia (recurrent)" carried entirely by "history"+"recurrent". These codes may
// only attach when the intent's own text uses explicit history/status phrasing (see
// EXPLICIT_HISTORY_INTENT); a narrative "history of X" where X is the presenting problem does not
// qualify. Exported for direct unit tests.
export function contradictsHistoryContext(intentText: string, code: string, codeDisplay: string): boolean {
  const isHistoryStatus =
    /^Z(8[0-7]|9[3-9])/.test(code.trim().toUpperCase()) || /^(personal|family) history of/i.test(codeDisplay);
  if (!isHistoryStatus) return false;
  return !EXPLICIT_HISTORY_INTENT.test(intentText);
}

// Exported for direct unit tests of the group vocabulary.
export function contradictsQualifiers(intentText: string, codeDisplay: string): boolean {
  for (const group of OPPOSING_QUALIFIER_GROUPS) {
    const inIntent = group.filter((m) => m.test(intentText));
    if (inIntent.length === 0) continue;
    const inDisplay = group.filter((m) => m.test(codeDisplay));
    if (inDisplay.length > 0 && !inDisplay.some((m) => inIntent.includes(m))) return true;
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

// ── Specificity upgrade ─────────────────────────────────────────────────────────────────────────
// The model often charts the base/unspecified variant when the narrative names laterality ("left
// ankle") or recurrence ("frequent ear infections") — attributes ICD-10 encodes as sibling codes
// inside the same 3-character category (H66.90 "…, unspecified ear" vs H66.92 "…, left ear"). When
// the intent's own text (display / searchTerms / sourceText) names exactly one such attribute and
// exactly ONE same-category sibling encodes it — its display differing from the validated code's
// only by that attribute — upgrade to the sibling. Anything else (conflicting sides, several
// candidates, no exact sibling, code already specific in that dimension) keeps the validated code:
// never cross-condition, never downgrade. Purely deterministic over the tabular data.
const LATERALITY_VALUES = ['left', 'right', 'bilateral'];
const RECURRENCE_INTENT = /\b(recurrent|recurring|frequent|repeated)\b/i;
// Displays phrase the side inconsistently ("…, unspecified ear" vs "…, bilateral" with no noun) —
// these filler nouns may differ between otherwise-identical siblings without meaning a different
// condition.
const SIDE_NOUN_SLACK = new Set(['ear', 'ears', 'eye', 'eyes', 'side']);

// Digits are load-bearing here ("stage 0" vs "stage 1", "type 1" vs "type 2") — a letters-only
// split would make numerically distinct siblings look base-identical.
function displayWords(display: string): Set<string> {
  return new Set(
    display
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}
function baseTokens(display: string, neutral: string[]): Set<string> {
  const out = displayWords(display);
  neutral.forEach((w) => out.delete(w));
  return out;
}
function differOnlyBySideNouns(a: Set<string>, b: Set<string>): boolean {
  for (const w of a) if (!b.has(w) && !SIDE_NOUN_SLACK.has(w)) return false;
  for (const w of b) if (!a.has(w) && !SIDE_NOUN_SLACK.has(w)) return false;
  return true;
}

// How many candidates the guards ask the search for. Text/code searches take the first
// non-contradicting candidate, so a few dozen ranked rows suffice; the category-sibling
// enumeration for the specificity upgrade must instead see the WHOLE 3-character category
// (S93 alone has 336 billable codes), so it pages much deeper — a category larger than the
// cap degrades safely to "no upgrade" only when the missing sibling was the unique match.
const SEARCH_LIMIT = 50;
const CATEGORY_SIBLING_LIMIT = 1000;

// One attribute dimension: find same-category siblings whose display carries `want` (and none of
// `forbid`) and equals the current display once the dimension's words (`neutral`) are set aside.
// Exactly one such sibling → upgrade; zero or several → keep the current code. The category
// prefix query enumerates the siblings; the startsWith re-check drops any display-text matches
// the search mixed in.
async function upgradeOneDimension(
  searchIcd: IcdSearchFn,
  current: { code: string; display: string },
  want: string,
  forbid: string[],
  neutral: string[]
): Promise<{ code: string; display: string }> {
  const category = current.code.slice(0, 3);
  const all = await searchIcd(category, CATEGORY_SIBLING_LIMIT);
  const base = baseTokens(current.display, neutral);
  const candidates = all.filter((c) => {
    if (!c.code.startsWith(category) || c.code === current.code) return false;
    const words = displayWords(c.display);
    if (!words.has(want) || forbid.some((w) => words.has(w))) return false;
    return differOnlyBySideNouns(base, baseTokens(c.display, neutral));
  });
  return candidates.length === 1 ? { code: candidates[0].code, display: candidates[0].display } : current;
}

// Exported for direct unit tests. Dimensions apply in sequence (laterality, then recurrence), so a
// narrative naming both can chain two single-attribute steps (H66.009 → H66.002 → H66.005).
export async function upgradeCodeSpecificity(
  searchIcd: IcdSearchFn,
  current: { code: string; display: string },
  intentTexts: Array<string | undefined>
): Promise<{ code: string; display: string }> {
  const intent = intentTexts
    .filter((t): t is string => typeof t === 'string' && !!t.trim())
    .join(' ')
    .toLowerCase();
  const intentWords = new Set(intent.split(/[^a-z]+/));
  let out = current;

  // Laterality: exactly one side named across the intent texts (two or more = conflicting → keep),
  // and the validated code encodes none.
  const sides = LATERALITY_VALUES.filter((v) => intentWords.has(v));
  if (sides.length === 1 && !LATERALITY_VALUES.some((v) => displayWords(out.display).has(v))) {
    out = await upgradeOneDimension(
      searchIcd,
      out,
      sides[0],
      LATERALITY_VALUES.filter((v) => v !== sides[0]),
      [...LATERALITY_VALUES, 'unspecified']
    );
  }

  // Recurrence: the narrative names it and the validated code doesn't already encode it. Base
  // comparison neutralizes only "recurrent", so a candidate may not smuggle in a laterality the
  // current code lacks.
  if (RECURRENCE_INTENT.test(intent) && !displayWords(out.display).has('recurrent')) {
    out = await upgradeOneDimension(searchIcd, out, 'recurrent', [], ['recurrent']);
  }
  return out;
}

// ── Etiology-support guard ──────────────────────────────────────────────────────────────────────
// ICD displays carry organism/etiology/type qualifiers ("GONOCOCCAL vulvovaginitis", "Acute SEROUS
// otitis media") that make a real code the WRONG code when the evidence never mentions that
// etiology — the review once proposed A54.02 (gonococcal) for a narrative documenting budding
// yeast (B37.3), and H65.06 (serous) for a bulging purulent AOM (H66.0x). Same defect shape and
// design as the med qualifier guard (MED_QUALIFIER_EVIDENCE in the EHR's intent-logic): each
// display token below maps to the evidence stems that justify it (substring-matched; stems ≤2
// chars must appear as a standalone evidence token). Tokens outside the vocabulary never count —
// this is a vocabulary of unambiguous qualifier WORDS, not a code blocklist, and a qualified code
// stays fully chartable whenever the evidence supports its qualifier. Stems are deliberately
// GENEROUS (any plausible synonym/marker of the etiology): a false "supported" only silences the
// guard, while a false "unsupported" would drop a correct suggestion.
export const ICD_ETIOLOGY_EVIDENCE: Record<string, string[]> = {
  gonococcal: ['gonococc', 'gonorrh', 'gc'],
  candidal: ['candid', 'yeast', 'thrush', 'monilial'],
  candidiasis: ['candid', 'yeast', 'thrush', 'monilial'],
  trichomonal: ['trichomon'],
  chlamydial: ['chlamyd'],
  syphilitic: ['syphil'],
  meningococcal: ['meningococc'],
  pneumococcal: ['pneumococc'],
  streptococcal: ['strep'],
  staphylococcal: ['staph'],
  tuberculous: ['tubercul', 'tb'],
  herpesviral: ['herp', 'hsv', 'cold sore'],
  herpetic: ['herp', 'hsv', 'cold sore'],
  viral: ['viral', 'virus', 'cold', 'flu', 'rsv', 'covid', 'enterovir', 'adenovir'],
  bacterial: ['bacteri', 'strep', 'staph'],
  fungal: ['fung', 'tinea', 'yeast', 'candid', 'dermatophyt', 'ringworm'],
  parasitic: ['parasit'],
  allergic: ['allerg', 'hay fever', 'atop', 'pollen', 'seasonal'],
  atopic: ['atop', 'eczema', 'allerg'],
  serous: ['serous', 'effusion', 'fluid'],
  nonsuppurative: ['nonsuppurat', 'serous', 'effusion', 'fluid'],
  suppurative: ['suppurat', 'purulent', 'pus'],
  purulent: ['purulent', 'suppurat', 'pus'],
  chronic: ['chronic', 'longstanding', 'long-standing', 'persistent', 'ongoing', 'month', 'year'],
  recurrent: ['recurrent', 'recurring', 'frequent', 'repeated', 'episode', 'keeps coming back', 'comes back', 'again'],
};

function etiologySupported(token: string, hay: string, hayTokens: Set<string>): boolean {
  return ICD_ETIOLOGY_EVIDENCE[token].some((s) => (s.length <= 2 ? hayTokens.has(s) : hay.includes(s)));
}

// The vocabulary qualifiers in an ICD display that the evidence haystack does NOT support.
// Exported for direct unit tests.
export function unsupportedEtiologyQualifiers(display: string, evidence: string): string[] {
  const hay = evidence.toLowerCase();
  // Short stems ('gc', 'tb') would substring-match inside unrelated words — credit them only as
  // standalone evidence tokens (same rule as unsupportedMedQualifiers).
  const hayTokens = new Set(hay.split(/[^a-z0-9]+/));
  const out: string[] = [];
  for (const tok of new Set(display.toLowerCase().split(/[^a-z0-9]+/))) {
    if (tok in ICD_ETIOLOGY_EVIDENCE && !etiologySupported(tok, hay, hayTokens)) out.push(tok);
  }
  return out;
}

// ONE deterministic repair attempt for a code whose display carries unsupported etiology
// qualifiers: search the index with the display stripped of the unsupported tokens — trying each
// evidence-SUPPORTED vocabulary qualifier as a prefix first ("suppurative acute otitis media …"),
// the bare stripped display last — and accept the first candidate whose display (a) has no
// unsupported qualifiers itself, (b) keeps every base condition token of the original display,
// (c) keeps the original display's laterality, and (d) can stand alone (no manifestation-only
// "in diseases classified elsewhere" codes). No such candidate → undefined; the caller drops.
// Exported for direct unit tests.
export async function repairUnsupportedEtiology(
  searchIcd: IcdSearchFn,
  flagged: { code?: string; display: string },
  evidence: string
): Promise<{ code: string; display: string } | undefined> {
  const hay = evidence.toLowerCase();
  const hayTokens = new Set(hay.split(/[^a-z0-9]+/));
  const unsupported = new Set(unsupportedEtiologyQualifiers(flagged.display, evidence));
  const words = flagged.display
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const stripped = words.filter((w) => !unsupported.has(w));
  const strippedQuery = stripped.join(' ');
  // Base condition tokens every replacement must keep — without them a same-organism code for a
  // DIFFERENT condition ("Candidal stomatitis") could impersonate the repair.
  const base = stripped.filter(
    (w) => w.length >= 4 && !CODE_DISPLAY_BOILERPLATE.has(w) && !(w in ICD_ETIOLOGY_EVIDENCE)
  );
  if (base.length === 0 || !strippedQuery) return undefined;
  const side = LATERALITY_VALUES.find((v) => words.includes(v));
  const supportedQualifiers = Object.keys(ICD_ETIOLOGY_EVIDENCE).filter(
    (t) => !words.includes(t) && etiologySupported(t, hay, hayTokens)
  );
  for (const q of [...supportedQualifiers.map((t) => `${t} ${strippedQuery}`), strippedQuery]) {
    const results = await searchIcd(q, SEARCH_LIMIT);
    const ok = results.find((r) => {
      if (flagged.code && r.code === flagged.code) return false;
      const normalizedDisplay = r.display.toLowerCase();
      if (normalizedDisplay.includes('in diseases classified elsewhere')) return false;
      if (unsupportedEtiologyQualifiers(r.display, evidence).length > 0) return false;
      if (side && !displayWords(r.display).has(side)) return false;
      const candidateWords = normalizedDisplay.split(/\s+/);
      return base.every((b) => wordMatchesDisplay(b, candidateWords, normalizedDisplay));
    });
    if (ok) return { code: ok.code, display: ok.display };
  }
  return undefined;
}

export async function resolveIcd(
  searchIcd: IcdSearchFn,
  suggestedCode: string | undefined,
  display: string,
  searchTerms: string[],
  sourceText?: string
): Promise<{ code: string; display: string } | undefined> {
  const intentTexts = [display, ...searchTerms, sourceText];
  const code = suggestedCode?.trim().toUpperCase();
  // 1. Exact-lookup the model's proposed code — the happy path needs no ranking.
  if (code && STRICT_ICD10.test(code)) {
    const byCode = await searchIcd(code, SEARCH_LIMIT);
    const exact = byCode.find((c) => c.code.toUpperCase() === code);
    // Laterality/position sanity: a real code can still be the WRONG code — the model once hinted
    // H00.012 (right lower eyelid) for a dictated LEFT UPPER stye. When the hint's display
    // contradicts the intent text on left/right or upper/lower, ignore the hint and let the
    // display-based search below pick the consistent code.
    if (
      exact &&
      !contradictsQualifiers(display, exact.display) &&
      !contradictsAnatomy(display, exact.display) &&
      !contradictsInjuryRegion(display, exact.code) &&
      !contradictsHistoryContext(display, exact.code, exact.display) &&
      displaysOverlap(display, exact.display)
    ) {
      return upgradeCodeSpecificity(searchIcd, { code: exact.code, display: exact.display }, intentTexts);
    }
  }
  // 2. Miss → text search by display, then each search term; take the top non-contradicting result
  //    (the ranking can surface a cross-organ code — "retained foreign body" once returned the
  //    EYELID code for a palm splinter, and a tailbone contusion once resolved to the EAR contusion
  //    code — so anatomy/laterality/region sanity applies here too). A query whose results ALL
  //    contradict the intent yields nothing rather than its top result: attaching a code the guard
  //    says is anatomically wrong is worse than making the client picker resolve by display.
  for (const q of [display, ...searchTerms]) {
    if (!q || !q.trim()) continue;
    const res = await searchIcd(q.trim(), SEARCH_LIMIT);
    const ok = res.find(
      (r) =>
        !contradictsQualifiers(display, r.display) &&
        !contradictsAnatomy(display, r.display) &&
        !contradictsInjuryRegion(display, r.code) &&
        !contradictsHistoryContext(display, r.code, r.display)
    );
    if (ok) return upgradeCodeSpecificity(searchIcd, { code: ok.code, display: ok.display }, intentTexts);
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
//
// `etiologyEvidence` (review-only today) additionally runs the etiology-support guard on
// add-diagnosis: a resolved display carrying a vocabulary qualifier the evidence does not support
// is deterministically repaired ('etiology-repaired', code+display substituted in place) or, when
// no clean replacement exists, refused ('etiology-unsupported' — the review drops the WHOLE
// suggestion: a swap reduced to its bare removal would recreate the zero-diagnoses bug).
export async function validateIntentCode(
  r: Record<string, unknown>,
  oystehr: Oystehr | undefined,
  etiologyEvidence?: string,
  icdSearch?: IcdSearchFn
): Promise<'ok' | 'invalid-billing' | 'etiology-repaired' | 'etiology-unsupported'> {
  if (r.kind === 'add-diagnosis' || r.kind === 'add-condition') {
    const searchIcd = icdSearch ?? (oystehr ? createTerminologyIcdSearch(oystehr) : undefined);
    if (!searchIcd) return 'ok'; // degraded: no client → can't validate, keep as-is
    const display = typeof r.display === 'string' ? r.display : '';
    const searchTerms = Array.isArray(r.searchTerms)
      ? (r.searchTerms.filter((t) => typeof t === 'string' && !!t.trim()) as string[])
      : [];
    const resolved = await resolveIcd(
      searchIcd,
      typeof r.code === 'string' ? r.code : undefined,
      display,
      searchTerms,
      typeof r.sourceText === 'string' ? r.sourceText : undefined
    );
    if (etiologyEvidence && r.kind === 'add-diagnosis') {
      // Guard the display that will actually be charted: the resolved canonical display, or the
      // model's own display when nothing resolved (the client picker would chart from it).
      const target = resolved ?? (display ? { code: undefined, display } : undefined);
      const unsupported = target ? unsupportedEtiologyQualifiers(target.display, etiologyEvidence) : [];
      if (target && unsupported.length > 0) {
        const repaired = await repairUnsupportedEtiology(searchIcd, target, etiologyEvidence);
        // Code + qualifier labels only — never evidence/narrative text.
        if (!repaired) {
          console.log(
            `easy-chart: etiology guard refused dx code ${target.code ?? '<unresolved>'} ` +
              `(unsupported: ${unsupported.join(', ')}), no clean replacement — dropping suggestion`
          );
          return 'etiology-unsupported';
        }
        console.log(
          `easy-chart: etiology guard repaired dx code ${target.code ?? '<unresolved>'} ` +
            `(unsupported: ${unsupported.join(', ')}) -> ${repaired.code}`
        );
        r.code = repaired.code;
        r.display = repaired.display;
        return 'etiology-repaired';
      }
    }
    if (resolved) {
      // The charted {code, display} pair must come from ONE terminology row — a corrected code
      // under the model's own display once paired "right index finger" text with the right-THUMB
      // code. The canonical display is also what the client's exact-code lookup charts anyway,
      // so syncing it here makes the reviewed pair match the charted one.
      r.code = resolved.code;
      r.display = resolved.display;
    } else {
      delete r.code; // nothing valid → the client picker resolves by display
    }
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
