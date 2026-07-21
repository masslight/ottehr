// Practice paperwork flows (OTR-2309), modeled as FHIR Questionnaire resources.
//
// A *flow* is a reusable, ordered bundle of practice-managed forms, assigned to service categories by
// visit mode. One flow == one Questionnaire; its derivedFrom pins the selected forms as `url|version`,
// and it records which visit modes it targets. Each assigned service-category HealthcareService is
// stamped, per targeted mode, with the flow's `url|version` in a dedicated extension (in-person /
// virtual); at most one per mode per service, so a booking resolves its mode's extension to the flow
// that drives its paperwork.
//
// Flows version like practice-managed forms: any change mints a new Questionnaire (bumped version) and
// retires the old, so a QuestionnaireResponse stays tied to the exact flow that drove it.
import { Extension, HealthcareService, Questionnaire } from 'fhir/r4b';
import {
  HEALTHCARE_SERVICE_QUESTIONNAIRE_INPERSON_EXTENSION_URL,
  HEALTHCARE_SERVICE_QUESTIONNAIRE_VIRTUAL_EXTENSION_URL,
  PAPERWORK_FLOW_MODE_EXTENSION_URL,
  PAPERWORK_FLOW_TYPE_SYSTEM,
  SERVICE_FLOW_TAG,
} from './constants';

export type PaperworkFlowMode = 'in-person' | 'virtual';
export const PAPERWORK_FLOW_MODES: PaperworkFlowMode[] = ['in-person', 'virtual'];

/** Flow canonical urls live in the same namespace as practice-managed questionnaires. */
export const makePaperworkFlowUrl = (slug: string): string => `https://ottehr.com/FHIR/Questionnaire/${slug}`;

/** Version minted for a brand-new flow (bumped on every subsequent edit). */
export const PAPERWORK_FLOW_BASE_VERSION = '1.0.0';

/** The HealthcareService extension url that points at a flow for a given visit mode. */
export const flowStampExtensionUrl = (mode: PaperworkFlowMode): string =>
  mode === 'in-person'
    ? HEALTHCARE_SERVICE_QUESTIONNAIRE_INPERSON_EXTENSION_URL
    : HEALTHCARE_SERVICE_QUESTIONNAIRE_VIRTUAL_EXTENSION_URL;

/** UI/zambda-facing record for a paperwork flow. */
export interface ServiceFlow {
  /** Stable slug (the last path segment of the canonical url); internal identity, not user-facing. */
  slug: string;
  name: string;
  url?: string;
  version?: string;
  status?: Questionnaire['status'];
  /** Ordered practice-managed form Questionnaire ids (UI-facing). */
  formIds: string[];
  /** Visit modes this flow targets. */
  modes: PaperworkFlowMode[];
}

export interface ServiceFlowWithServices extends ServiceFlow {
  /** Service-category (HealthcareService) ids this flow is assigned to. */
  serviceIds: string[];
}

// ── canonical (url|version) helpers ──────────────────────────────────────────

export function parseCanonical(canonical: string): { url: string; version?: string } {
  const [url, version] = canonical.split('|');
  return { url, version: version || undefined };
}

export function buildCanonical(url: string, version: string | undefined): string {
  return version ? `${url}|${version}` : url;
}

// ── tag / modes ───────────────────────────────────────────────────────────────

export function isPaperworkFlow(q: Questionnaire): boolean {
  return (q.meta?.tag ?? []).some((t) => t.system === PAPERWORK_FLOW_TYPE_SYSTEM && t.code === SERVICE_FLOW_TAG.code);
}

export function getFlowModes(q: Questionnaire): PaperworkFlowMode[] {
  const modes = (q.extension ?? [])
    .filter((e) => e.url === PAPERWORK_FLOW_MODE_EXTENSION_URL)
    .map((e) => e.valueCode)
    .filter((c): c is PaperworkFlowMode => c === 'in-person' || c === 'virtual');
  return PAPERWORK_FLOW_MODES.filter((m) => modes.includes(m));
}

// ── derivedFrom (forms) / slug ─────────────────────────────────────────────────

export function getFlowFormCanonicals(q: Questionnaire): string[] {
  return (q.derivedFrom ?? []).filter((d): d is string => typeof d === 'string');
}

export function getFlowSlug(q: Questionnaire): string | undefined {
  return q.url?.split('/').pop();
}

// ── record parsing ──────────────────────────────────────────────────────────────

/** Parse a paperwork flow Questionnaire into a record. `resolveFormId` maps a derivedFrom canonical
 *  (`url|version`) to the UI-facing practice-managed form id; entries it can't resolve are dropped. */
export function toServiceFlowRecord(
  q: Questionnaire,
  resolveFormId: (canonical: string) => string | undefined
): ServiceFlow | null {
  if (!isPaperworkFlow(q)) return null;
  const slug = getFlowSlug(q);
  if (!slug) return null;
  return {
    slug,
    name: q.title ?? slug,
    url: q.url,
    version: q.version,
    status: q.status,
    formIds: getFlowFormCanonicals(q)
      .map(resolveFormId)
      .filter((id): id is string => !!id),
    modes: getFlowModes(q),
  };
}

// ── Questionnaire builder ───────────────────────────────────────────────────────

export interface BuildFlowInput {
  id?: string;
  slug: string;
  name: string;
  version: string;
  status?: Questionnaire['status'];
  modes: PaperworkFlowMode[];
  /** Resolved `url|version` canonicals for the attached practice-managed forms, in order. */
  formCanonicals: string[];
}

export function buildFlowQuestionnaire(input: BuildFlowInput): Questionnaire {
  const extension: Extension[] = input.modes.map((mode) => ({
    url: PAPERWORK_FLOW_MODE_EXTENSION_URL,
    valueCode: mode,
  }));
  return {
    resourceType: 'Questionnaire',
    ...(input.id ? { id: input.id } : {}),
    url: makePaperworkFlowUrl(input.slug),
    version: input.version,
    name: input.slug,
    title: input.name,
    status: input.status ?? 'active',
    meta: { tag: [SERVICE_FLOW_TAG] },
    ...(extension.length > 0 ? { extension } : {}),
    derivedFrom: input.formCanonicals,
  };
}

// ── HealthcareService per-mode flow stamp ────────────────────────────────────────

/** Read the flow canonical (`url|version`) stamped on a HealthcareService for a visit mode. */
export function readFlowStamp(hs: HealthcareService, mode: PaperworkFlowMode): string | undefined {
  return (hs.extension ?? []).find((e) => e.url === flowStampExtensionUrl(mode))?.valueCanonical;
}

/** Return a copy of the HS with its per-mode flow stamp set or cleared (preserving other extensions). */
export function withFlowStamp(
  hs: HealthcareService,
  mode: PaperworkFlowMode,
  canonical: string | undefined
): HealthcareService {
  const url = flowStampExtensionUrl(mode);
  const others = (hs.extension ?? []).filter((e) => e.url !== url);
  const next = canonical ? [...others, { url, valueCanonical: canonical }] : others;
  return { ...hs, extension: next.length > 0 ? next : undefined };
}

// ── zambda I/O types (shared with the EHR api client) ─────────────────────────────

export interface PaperworkFlowListOutput {
  flows: ServiceFlowWithServices[];
}

/** The editable shape of a flow as authored in the dialog (slug is derived server-side on create). */
export interface ServiceFlowInput {
  name: string;
  formIds: string[];
  modes: PaperworkFlowMode[];
}

export interface PaperworkFlowCreateInput {
  flow: ServiceFlowInput;
  serviceIds: string[];
}

export interface PaperworkFlowCreateOutput {
  flow: ServiceFlowWithServices;
}

export type PaperworkFlowUpdateInput =
  | { updateType: 'service-flow'; slug: string; flow: ServiceFlowInput; serviceIds: string[] }
  | { updateType: 'retire'; slug: string };

export interface PaperworkFlowUpdateOutput {
  flow?: ServiceFlowWithServices;
  success?: boolean;
}
