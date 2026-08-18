// Resolving a dictated order to something orderable: labs and imaging.
//
// Pure and dependency-free so the preconditions and the matchers can be unit-tested offline. None of
// these values come from the dictation beyond the NAME of the test or study — the office, the payment
// method and the CPT are resolved from the encounter, the patient's coverage and the practice's own
// catalogues, exactly the way the regular Labs and Radiology tabs resolve them.
//
// "Never guess in a medical record" means never invent a value. It does not mean refuse to act:
// declining to support an action silently loses a voiced order, which is its own patient-safety
// problem. Resolve from real data, ask when genuinely ambiguous, and when resolution truly fails skip
// the step with the test or study NAMED in the reason.

import { LabPaymentMethod } from '../types/data/labs/labs.types';

/**
 * Words that describe the ACT of ordering rather than the thing ordered. Discovered knowledge: each
 * one pulled a match onto the wrong test before it was stripped.
 */
export const LAB_QUERY_STOPWORDS = new Set([
  'order',
  'send',
  'run',
  'a',
  'an',
  'the',
  'out',
  'in',
  'house',
  'office',
  'lab',
  'labs',
  'test',
  'tests',
  'do',
  'get',
  'please',
  'to',
  'and',
  'for',
  'reference',
  'panel',
]);

const tokenizeOrder = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

export interface ScoredCatalogueItem<T> {
  item: T;
  score: number;
}

/**
 * Token-overlap scoring for a named catalogue (in-house tests, send-out orderable items).
 *
 * The weights are carried over rather than re-derived: a whole-token hit dominates a prefix hit, an
 * exact name wins outright, and a catalogue name much longer than the query is penalised so "Flu A"
 * is not beaten by "Respiratory Panel by PCR, 22 targets" on one shared word.
 */
export function matchNamedCatalogue<T>(
  display: string,
  searchTerms: string[] | undefined,
  items: T[],
  getName: (item: T) => string
): ScoredCatalogueItem<T>[] {
  const queryTokens = [
    ...new Set(
      [display, ...(searchTerms ?? [])]
        .flatMap(tokenizeOrder)
        .filter((token) => token.length >= 2 && !LAB_QUERY_STOPWORDS.has(token))
    ),
  ];
  if (queryTokens.length === 0) return [];

  const exact = display.trim().toLowerCase();

  return items
    .map((item) => {
      const name = getName(item);
      const nameTokens = tokenizeOrder(name);
      let score = 0;
      for (const token of queryTokens) {
        if (nameTokens.includes(token)) score += 20;
        else if (nameTokens.some((nameToken) => nameToken.startsWith(token))) score += 5;
      }
      if (name.trim().toLowerCase() === exact) score += 1000;
      score -= Math.max(0, nameTokens.length - queryTokens.length) * 2;
      return { item, score };
    })
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Modalities the in-clinic imaging catalogue does not carry. NOT OPTIONAL.
 *
 * Without it, "venous duplex ultrasound" resolved to CPT 73590, "X-ray of lower leg" — a wrong study
 * charted with full confidence, because partial-word matching found the body part. Across modalities,
 * no match is strictly safer than a good-looking match.
 */
export const NON_XRAY_MODALITY =
  /\b(?:ultrasound|duplex|doppler|sonogram|sonography|echocardiogram|echocardiography|cat scan|mri|magnetic resonance|nuclear)\b|\bus\b|\bct\b|\bv\/q\b/i;

export interface RadiologyStudyOption {
  code?: string;
  display?: string;
}

/** Words that describe the study's framing rather than its anatomy. */
const RADIOLOGY_STOPWORDS = new Set(['xray', 'ray', 'view', 'views', 'minimum', 'the', 'and', 'for']);

export type RadiologyMatch<T extends RadiologyStudyOption> =
  | { status: 'matched'; study: T; code: string }
  | { status: 'wrong-modality' }
  | { status: 'no-match' };

/**
 * Resolve a dictated study to a catalogue entry by anatomy-keyword overlap — view count and
 * laterality vary between how a provider says it and how the catalogue names it, so the body-part
 * words are what carry the match. The model never supplies a CPT.
 */
export function matchRadiologyStudy<T extends RadiologyStudyOption>(
  display: string,
  searchTerms: string[] | undefined,
  studies: T[]
): RadiologyMatch<T> {
  const haystack = `${display} ${(searchTerms ?? []).join(' ')}`.toLowerCase();
  if (NON_XRAY_MODALITY.test(haystack)) return { status: 'wrong-modality' };

  let best: { study: T; score: number } | undefined;
  for (const study of studies) {
    if (!study.display || !study.code) continue;
    const words = study.display
      .toLowerCase()
      .replace(/[^a-z ]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !RADIOLOGY_STOPWORDS.has(word));
    const score = words.filter((word) => haystack.includes(word)).length;
    if (score > 0 && (!best || score > best.score)) best = { study, score };
  }

  if (!best?.study.code) return { status: 'no-match' };
  return { status: 'matched', study: best.study, code: best.study.code };
}

/**
 * The payment method a send-out order gets. DERIVED, never asked and never invented — the same
 * defaulting the regular Labs tab applies, and the provider can change it on the order afterwards.
 */
export function resolveLabPaymentMethod(input: {
  appointmentIsWorkersComp: boolean;
  coverageCount: number;
}): LabPaymentMethod {
  if (input.appointmentIsWorkersComp) return LabPaymentMethod.WorkersComp;
  if (input.coverageCount > 0) return LabPaymentMethod.Insurance;
  return LabPaymentMethod.SelfPay;
}

/**
 * The office a send-out order is placed from: the encounter's own location when it is lab-enabled,
 * else the single lab-enabled office if there is exactly one. With several and no match on the
 * encounter, there is no defensible choice — return undefined so the caller skips with a reason
 * rather than picking one.
 */
export function resolveOrderingOffice<T extends { id: string; enabledLabs: unknown[] }>(
  orderingLocations: T[] | undefined,
  encounterLocationId: string | undefined
): T | undefined {
  const labEnabled = (orderingLocations ?? []).filter((location) => location.enabledLabs.length > 0);
  const atEncounter = labEnabled.find((location) => location.id === encounterLocationId);
  if (atEncounter) return atEncounter;
  return labEnabled.length === 1 ? labEnabled[0] : undefined;
}

/** The lab-organisation id list the send-out catalogue search is scoped to. */
export function labOrgIdsFor(office: { enabledLabs: { labOrgRef: string }[] }): string {
  return office.enabledLabs.map((enabled) => enabled.labOrgRef.replace('Organization/', '')).join(',');
}
