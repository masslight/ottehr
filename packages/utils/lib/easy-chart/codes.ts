// ICD-10/CPT shape validators and qualifier evidence tables. A shape check does not confirm that a code exists;
// that needs the terminology service.

/** Anchored, non-global: validates a single candidate code end to end. */
export const STRICT_ICD10 = /^[A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?$/;
/** Scanning counterpart of STRICT_ICD10, for finding codes inside text. Keep the two patterns in sync. */
export const ICD10_SCAN = /\b([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?)\b/g;
/** Numeric CPT, E&M 99xxx included. Category II/III codes end in a letter and do not pass. */
const STRICT_CPT = /^\d{4,5}$/;

export function isIcd10Shaped(code: string | undefined): boolean {
  return !!code && STRICT_ICD10.test(code.trim().toUpperCase());
}

export function isCptShaped(code: string | undefined): boolean {
  return !!code && STRICT_CPT.test(code.trim());
}

/** Every ICD-10-shaped token in a block of text. Non-mutating: the global regex's lastIndex is not shared. */
export function scanIcd10Codes(text: string): string[] {
  return [...text.matchAll(new RegExp(ICD10_SCAN.source, 'g'))].map((m) => m[1]);
}

/** Z80–Z92, the personal/family-history blocks, which the model often charts for a current problem. */
export function isPersonalHistoryCode(code: string | undefined): boolean {
  if (!code) return false;
  const match = /^Z(\d{2})/i.exec(code.trim());
  if (!match) return false;
  const block = Number(match[1]);
  return block >= 80 && block <= 92;
}

/**
 * Organism or aetiology qualifier in a code's display → narrative evidence stems that justify it, so
 * "gonococcal" pharyngitis is not charted off a plain sore throat.
 */
export const ETIOLOGY_QUALIFIER_EVIDENCE: Record<string, string[]> = {
  gonococcal: ['gonococc', 'gonorrh', 'gc'],
  candidal: ['candid', 'yeast', 'thrush', 'monilial'],
  candidiasis: ['candid', 'yeast', 'thrush', 'monilial'],
  trichomonal: ['trichomon'],
  chlamydial: ['chlamyd'],
  syphilitic: ['syphil'],
  meningococcal: ['meningococc'],
  pneumococcal: ['pneumococc'],
  streptococcal: ['strep'],
  staphylococcal: ['staph', 'mrsa', 'mssa'],
  tuberculous: ['tubercul', 'tb'],
  herpesviral: ['herp', 'hsv', 'cold sore'],
  herpetic: ['herp', 'hsv', 'cold sore'],
  influenzal: ['influenza', 'flu'],
  mycoplasma: ['mycoplasma'],
  rsv: ['rsv', 'respiratory syncytial'],
  amebic: ['ameb', 'amoeb'],
  rheumatic: ['rheumatic'],
  gouty: ['gout'],
  diabetic: ['diabet'],
  alcoholic: ['alcohol'],
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

/** Stems of two characters or fewer ("gc", "tb") count only as whole tokens, not as substrings. */
function etiologySupported(qualifier: string, haystack: string, haystackTokens: Set<string>): boolean {
  return (ETIOLOGY_QUALIFIER_EVIDENCE[qualifier] ?? []).some((stem) =>
    stem.length <= 2 ? haystackTokens.has(stem) : haystack.includes(stem)
  );
}

/** Every vocabulary qualifier the evidence supports and the display does not already carry. */
export function supportedEtiologyQualifiers(display: string, evidence: string): string[] {
  const haystack = evidence.toLowerCase();
  const haystackTokens = new Set(haystack.split(/[^a-z0-9]+/));
  const displayWords = display.toLowerCase().split(/[^a-z0-9]+/);
  return Object.keys(ETIOLOGY_QUALIFIER_EVIDENCE).filter(
    (qualifier) => !displayWords.includes(qualifier) && etiologySupported(qualifier, haystack, haystackTokens)
  );
}

/**
 * Which aetiology qualifiers a code's description asserts that the narrative does not support. A
 * non-empty result means the code must not be charted as-is.
 */
export function unsupportedEtiologyQualifiers(codeDisplay: string, narrative: string): string[] {
  const haystack = narrative.toLowerCase();
  const haystackTokens = new Set(haystack.split(/[^a-z0-9]+/));
  const out: string[] = [];
  // Tokenised, so "viral" does not fire inside "antiviral".
  for (const token of new Set(codeDisplay.toLowerCase().split(/[^a-z0-9]+/))) {
    if (token in ETIOLOGY_QUALIFIER_EVIDENCE && !etiologySupported(token, haystack, haystackTokens)) out.push(token);
  }
  return out;
}

/**
 * Care-context qualifiers (childbirth, newborn, surgical complication) → evidence that the visit involved that
 * setting. Without it, "laceration" can resolve to "Third degree perineal laceration during delivery".
 */
const CONTEXT_QUALIFIER_EVIDENCE: Record<string, string[]> = {
  'during delivery': ['deliver', 'labor', 'labour', 'birth', 'obstetric', 'postpartum', 'perineal'],
  'birth injuries': ['birth', 'deliver', 'newborn', 'neonat'],
  'birth injury': ['birth', 'deliver', 'newborn', 'neonat'],
  obstetric: ['obstetric', 'deliver', 'birth', 'pregnan', 'postpartum'],
  'associated with lactation': ['lactat', 'breastfeed', 'nursing', 'breast'],
  'complicating pregnancy': ['pregnan', 'gestation'],
  'following abortion': ['abortion', 'miscarriage'],
  'during a procedure': ['procedure', 'intraoperative', 'surgery', 'operative'],
  intraoperative: ['intraoperative', 'surgery', 'operative', 'procedure'],
  'in the puerperium': ['puerper', 'postpartum', 'deliver', 'birth'],
};

/**
 * Care-context qualifiers the display asserts but the narrative does not support. Phrase-matched, because
 * "delivery" alone is a word a visit can use innocently.
 */
export function unsupportedContextQualifiers(codeDisplay: string, narrative: string): string[] {
  const display = codeDisplay.toLowerCase();
  const haystack = narrative.toLowerCase();
  return Object.entries(CONTEXT_QUALIFIER_EVIDENCE)
    .filter(([qualifier]) => display.includes(qualifier))
    .filter(([, evidence]) => !evidence.some((word) => haystack.includes(word)))
    .map(([qualifier]) => qualifier);
}
