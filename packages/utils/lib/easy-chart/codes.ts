// Code-shape validators.
//
// These are SHAPE CHECKS ONLY. A code that passes still has to be confirmed against the terminology
// service, and the charted {code, display} pair must come from ONE terminology row — never a
// model-supplied code paired with a searched display, or vice versa. Telling the model in the prompt
// that this validation happens is what lets it propose codes confidently instead of leaving them
// blank, which measurably improves specificity.

/** Anchored, non-global: validates a single candidate code end to end. */
export const STRICT_ICD10 = /^[A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?$/;
/**
 * Global, word-bounded scanning counterpart of STRICT_ICD10, for finding code-shaped tokens inside
 * narrative text. Keep the two patterns in sync — they exist as a pair because one validates and one
 * scans.
 */
export const ICD10_SCAN = /\b([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?)\b/g;
/** CPT, including the E&M 99xxx family. */
export const STRICT_CPT = /^\d{4,5}$/;
/** HCPCS Level II (J-codes and friends). */
export const STRICT_HCPCS = /^[A-V]\d{4}$/;

export function isIcd10Shaped(code: string | undefined): boolean {
  return !!code && STRICT_ICD10.test(code.trim().toUpperCase());
}

export function isCptShaped(code: string | undefined): boolean {
  return !!code && STRICT_CPT.test(code.trim());
}

export function isHcpcsShaped(code: string | undefined): boolean {
  return !!code && STRICT_HCPCS.test(code.trim().toUpperCase());
}

/** Every ICD-10-shaped token in a block of text. Non-mutating: the global regex's lastIndex is not shared. */
export function scanIcd10Codes(text: string): string[] {
  return [...text.matchAll(new RegExp(ICD10_SCAN.source, 'g'))].map((m) => m[1]);
}

/**
 * A "history of…" Z-code charted for a problem the patient has RIGHT NOW is a coding error the model
 * makes regularly. Z80-Z92 are the personal/family-history blocks.
 */
export function isPersonalHistoryCode(code: string | undefined): boolean {
  if (!code) return false;
  const match = /^Z(\d{2})/i.exec(code.trim());
  if (!match) return false;
  const block = Number(match[1]);
  return block >= 80 && block <= 92;
}

/**
 * A code carrying an organism or aetiology qualifier is only chartable when the visit supports it —
 * the model will otherwise code "gonococcal" pharyngitis off a sore throat. Each entry maps a
 * qualifier word appearing in the code's own DESCRIPTION to the evidence words that would justify it
 * in the narrative.
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

/**
 * Is ONE qualifier supported by the evidence? Stems of two characters or less ("gc", "tb") would
 * substring-match inside unrelated words, so they are credited only as standalone evidence tokens.
 */
function etiologySupported(qualifier: string, haystack: string, haystackTokens: Set<string>): boolean {
  return (ETIOLOGY_QUALIFIER_EVIDENCE[qualifier] ?? []).some((stem) =>
    stem.length <= 2 ? haystackTokens.has(stem) : haystack.includes(stem)
  );
}

/** Every vocabulary qualifier the evidence supports and the display does NOT already carry. */
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
  // Tokenised, not substring-matched: a substring test made "viral" fire on "antiviral" and
  // "chronic" fire inside unrelated words, and the qualifier has to be a WORD of the display.
  for (const token of new Set(codeDisplay.toLowerCase().split(/[^a-z0-9]+/))) {
    if (token in ETIOLOGY_QUALIFIER_EVIDENCE && !etiologySupported(token, haystack, haystackTokens)) out.push(token);
  }
  return out;
}

/**
 * CARE-CONTEXT qualifiers: a code display can name the setting the condition arose in — childbirth, the
 * newborn period, a surgical complication — and such a code is the wrong code whenever the visit
 * describes none of that, no matter how well the condition word matches.
 *
 * This is the same shape as the aetiology guard and it exists for the same reason: measured behaviour.
 * The terminology search cannot reach the S-chapter injury codes from a description, so a query for a
 * forehead laceration returns "Third degree perineal laceration during delivery", "Other birth injuries
 * to scalp" and "Accidental puncture and laceration ... during a circulatory system procedure" — all
 * real codes sharing the condition word, none contradicting any anatomy the guard knows about.
 */
export const CONTEXT_QUALIFIER_EVIDENCE: Record<string, string[]> = {
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
 * Which care-context qualifiers a display asserts that the narrative does not support. Phrase-matched,
 * not tokenised: the qualifiers here are multi-word settings, and "delivery" alone is a word a visit can
 * use innocently.
 */
export function unsupportedContextQualifiers(codeDisplay: string, narrative: string): string[] {
  const display = codeDisplay.toLowerCase();
  const haystack = narrative.toLowerCase();
  return Object.entries(CONTEXT_QUALIFIER_EVIDENCE)
    .filter(([qualifier]) => display.includes(qualifier))
    .filter(([, evidence]) => !evidence.some((word) => haystack.includes(word)))
    .map(([qualifier]) => qualifier);
}

/**
 * Laterality asserted by a code description, or undefined when it names no side. Used to check the
 * code against the side the narrative actually diagnoses — laterality is the side DIAGNOSED, not the
 * side examined.
 */
export function codeLaterality(codeDisplay: string): 'left' | 'right' | 'bilateral' | undefined {
  const display = codeDisplay.toLowerCase();
  if (/\bbilateral\b/.test(display)) return 'bilateral';
  if (/\bleft\b/.test(display)) return 'left';
  if (/\bright\b/.test(display)) return 'right';
  return undefined;
}
