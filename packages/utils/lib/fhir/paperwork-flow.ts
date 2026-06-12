import { List } from 'fhir/r4b';
import {
  PAPERWORK_FLOW_BASE_EXTENSION_URL,
  PAPERWORK_FLOW_BASES,
  PAPERWORK_FLOW_CANONICAL_EXTENSION_URL,
  PAPERWORK_FLOW_IDENTIFIER_SYSTEM,
  PAPERWORK_FLOW_TAG,
  PaperworkFlowBase,
} from './constants';

// A reusable practice paperwork flow (OTR-2309): a base intake + an ordered set of
// practice-managed form Questionnaires. Persisted as a FHIR List; ServiceCategories
// reference one by id and booked Appointments are stamped with the resolved flow id.
export interface PaperworkFlow {
  /** List.id — present for persisted flows. */
  id?: string;
  /** Stable, human-authored slug (List.identifier value). */
  slug: string;
  /** Display name (List.title). */
  name: string;
  /** Base intake: 'standard' (mode-resolved full intake) or 'consent-only' (lite). */
  base: PaperworkFlowBase;
  /** Ordered practice-managed form Questionnaire ids included after the base intake. */
  formIds: string[];
  /**
   * Set only on *base* flows: the base intake canonical this flow's forms attach to
   * (in-person / virtual / consent-only URL). Undefined on service flows. A booking
   * composes the base flow for its resolved canonical with its service flow.
   */
  canonical?: string;
}

const isPaperworkFlowBase = (v: unknown): v is PaperworkFlowBase =>
  typeof v === 'string' && (PAPERWORK_FLOW_BASES as string[]).includes(v);

/** Whether a List is a practice paperwork flow (carries the flow tag). */
export function isPaperworkFlowList(list: List): boolean {
  return (list.meta?.tag ?? []).some(
    (t) => t.system === PAPERWORK_FLOW_TAG.system && t.code === PAPERWORK_FLOW_TAG.code
  );
}

/** Read the base intake from a paperwork-flow List; defaults to 'standard' when absent/invalid. */
export function getPaperworkFlowBase(list: List): PaperworkFlowBase {
  const raw = (list.extension ?? []).find((e) => e.url === PAPERWORK_FLOW_BASE_EXTENSION_URL)?.valueCode;
  return isPaperworkFlowBase(raw) ? raw : 'standard';
}

/** The base intake canonical a List is bound to, or undefined (service flows have none). */
export function getPaperworkFlowCanonical(list: List): string | undefined {
  return (list.extension ?? []).find((e) => e.url === PAPERWORK_FLOW_CANONICAL_EXTENSION_URL)?.valueUri;
}

/** Whether a List is a *base* paperwork flow (bound to a base intake canonical) vs a service flow. */
export function isBaseFlow(list: List): boolean {
  return isPaperworkFlowList(list) && getPaperworkFlowCanonical(list) !== undefined;
}

/**
 * The forms a booking shows (OTR-2309 v2): the base intake's forms first, then the service
 * flow's forms, de-duplicated keep-first (a form in both keeps its base-flow position).
 */
export function composeFormIds(baseFormIds: string[], serviceFormIds: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of [...baseFormIds, ...serviceFormIds]) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

/** Read the ordered practice-managed form Questionnaire ids referenced by a flow List. */
export function getPaperworkFlowFormIds(list: List): string[] {
  return (list.entry ?? [])
    .map((e) => e.item?.reference)
    .filter((ref): ref is string => typeof ref === 'string' && ref.startsWith('Questionnaire/'))
    .map((ref) => ref.split('/').pop() as string);
}

/** Parse a paperwork-flow List into a record. Returns null when the List isn't a flow or lacks a slug. */
export function toPaperworkFlowRecord(list: List): PaperworkFlow | null {
  if (!isPaperworkFlowList(list)) return null;
  const slug = (list.identifier ?? []).find((i) => i.system === PAPERWORK_FLOW_IDENTIFIER_SYSTEM)?.value;
  if (!slug) return null;
  return {
    id: list.id,
    slug,
    name: list.title ?? slug,
    base: getPaperworkFlowBase(list),
    formIds: getPaperworkFlowFormIds(list),
    canonical: getPaperworkFlowCanonical(list),
  };
}

/** Build the FHIR List resource for a paperwork-flow record (for create/update). */
export function paperworkFlowToFhirList(record: PaperworkFlow): List {
  return {
    resourceType: 'List',
    ...(record.id ? { id: record.id } : {}),
    status: 'current',
    mode: 'working',
    title: record.name,
    meta: { tag: [PAPERWORK_FLOW_TAG] },
    identifier: [{ system: PAPERWORK_FLOW_IDENTIFIER_SYSTEM, value: record.slug }],
    extension: [
      { url: PAPERWORK_FLOW_BASE_EXTENSION_URL, valueCode: record.base },
      ...(record.canonical ? [{ url: PAPERWORK_FLOW_CANONICAL_EXTENSION_URL, valueUri: record.canonical }] : []),
    ],
    entry: record.formIds.map((id) => ({ item: { reference: `Questionnaire/${id}` } })),
  };
}
