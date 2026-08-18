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
  gonococcal: ['gonococc', 'gonorrhea', 'gonorrhoea', 'gc '],
  chlamydial: ['chlamyd'],
  syphilitic: ['syphil'],
  tuberculous: ['tubercul', ' tb '],
  candidal: ['candid', 'yeast', 'thrush'],
  streptococcal: ['strep'],
  staphylococcal: ['staph', 'mrsa', 'mssa'],
  gonorrhea: ['gonococc', 'gonorrhea', 'gonorrhoea'],
  herpesviral: ['herpes', 'hsv'],
  influenzal: ['influenza', 'flu '],
  pneumococcal: ['pneumococc'],
  meningococcal: ['meningococc'],
  mycoplasma: ['mycoplasma'],
  rsv: ['rsv', 'respiratory syncytial'],
  'e. coli': ['e. coli', 'e.coli', 'escherichia'],
  gonorrheal: ['gonococc', 'gonorrhea'],
  amebic: ['ameb', 'amoeb'],
  rheumatic: ['rheumatic fever', 'rheumatic'],
  gouty: ['gout'],
  diabetic: ['diabet'],
  alcoholic: ['alcohol'],
};

/**
 * Which aetiology qualifiers a code's description asserts that the narrative does not support. A
 * non-empty result means the code must not be charted as-is.
 */
export function unsupportedEtiologyQualifiers(codeDisplay: string, narrative: string): string[] {
  const display = codeDisplay.toLowerCase();
  const haystack = ` ${narrative.toLowerCase()} `;
  return Object.entries(ETIOLOGY_QUALIFIER_EVIDENCE)
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
