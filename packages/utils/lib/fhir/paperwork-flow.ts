// Practice paperwork flows (OTR-2309), modeled as FHIR Questionnaire resources.
//
// A *flow* is a reusable, ordered bundle of intake paperwork. There are two kinds:
//   - Base intake flow: one per visit mode (In-person / Virtual). Fixed slug; derivedFrom is
//     [ <raw mode intake canonical, pinned first>, ...<attached practice-managed form canonicals> ].
//   - Service flow: authored as ONE logical flow but materialized as one Questionnaire per applicable
//     visit mode (a both-mode service -> an in-person variant + a virtual variant). All variants share
//     a group identifier (so the UI regroups them into one flow) and each carries a mode marker and a
//     base-kind marker. Each variant's derivedFrom is [ <that mode's base representative>, ...<forms> ].
//
// Flows version the same way practice-managed forms do: any change mints a new Questionnaire (bumped
// version) and retires the old, so a QuestionnaireResponse stays tied to the exact flow that drove it.
// derivedFrom pins `url|version` canonicals; editing a base intake card cascades to the service flow
// variants that reference it (see the paperwork-flow zambdas).
import { Extension, Questionnaire } from 'fhir/r4b';
import {
  BASE_INTAKE_FLOW_TAG,
  PAPERWORK_FLOW_BASE_EXTENSION_URL,
  PAPERWORK_FLOW_GROUP_SYSTEM,
  PAPERWORK_FLOW_MODE_EXTENSION_URL,
  PAPERWORK_FLOW_TYPE_SYSTEM,
  SERVICE_FLOW_TAG,
} from './constants';

export type PaperworkFlowMode = 'in-person' | 'virtual';
export type PaperworkFlowBaseKind = 'standard' | 'consent-only';

export const PAPERWORK_FLOW_MODES: PaperworkFlowMode[] = ['in-person', 'virtual'];

/** Fixed slugs for the two base intake flow cards; the visit mode is recoverable from the slug. */
export const BASE_INTAKE_FLOW_SLUG: Record<PaperworkFlowMode, string> = {
  'in-person': 'base-intake-in-person',
  virtual: 'base-intake-virtual',
};

/** Flow canonical urls live in the same namespace as practice-managed questionnaires. */
export const makePaperworkFlowUrl = (slug: string): string => `https://ottehr.com/FHIR/Questionnaire/${slug}`;

/** The per-mode variant slug for a logical service flow (its canonical url is mode-suffixed & unique). */
export const serviceFlowVariantSlug = (groupSlug: string, mode: PaperworkFlowMode): string => `${groupSlug}-${mode}`;

/** Version minted for a brand-new flow (bumped on every subsequent edit). */
export const PAPERWORK_FLOW_BASE_VERSION = '1.0.0';

/** A base intake flow card record (one per visit mode). */
export interface BaseIntakeFlow {
  /** Questionnaire.id of the latest version — present once the card has been materialized. */
  id?: string;
  /** Fixed slug (base-intake-in-person / base-intake-virtual). */
  slug: string;
  /** Display name. */
  name: string;
  mode: PaperworkFlowMode;
  url?: string;
  version?: string;
  status?: Questionnaire['status'];
  /** Ordered practice-managed form Questionnaire ids attached after the raw mode intake (UI-facing). */
  formIds: string[];
}

/** A logical service flow (grouped from its per-mode Questionnaire variants). */
export interface ServiceFlow {
  /** Group slug — the stable identity of the logical flow (shared by its mode variants). */
  slug: string;
  /** Display name. */
  name: string;
  /** Base intake kind applied ahead of the flow's own forms. */
  base: PaperworkFlowBaseKind;
  /** Ordered practice-managed form Questionnaire ids (UI-facing), shared across mode variants. */
  formIds: string[];
  /** Which visit-mode variants currently exist for this flow. */
  modes: PaperworkFlowMode[];
}

/** A service flow enriched with the service-category ids it is assigned to. */
export interface ServiceFlowWithServices extends ServiceFlow {
  serviceIds: string[];
}

// ── canonical (url|version) helpers ──────────────────────────────────────────

/** Split a `url|version` canonical string into parts (version optional). */
export function parseCanonical(canonical: string): { url: string; version?: string } {
  const [url, version] = canonical.split('|');
  return { url, version: version || undefined };
}

/** Build a `url|version` canonical string (omits the version segment when absent). */
export function buildCanonical(url: string, version: string | undefined): string {
  return version ? `${url}|${version}` : url;
}

// ── tag discriminators ───────────────────────────────────────────────────────

function hasTag(q: Questionnaire, system: string, code: string): boolean {
  return (q.meta?.tag ?? []).some((t) => t.system === system && t.code === code);
}

export function isBaseIntakeFlow(q: Questionnaire): boolean {
  return hasTag(q, BASE_INTAKE_FLOW_TAG.system, BASE_INTAKE_FLOW_TAG.code);
}

export function isServiceFlow(q: Questionnaire): boolean {
  return hasTag(q, SERVICE_FLOW_TAG.system, SERVICE_FLOW_TAG.code);
}

export function isPaperworkFlow(q: Questionnaire): boolean {
  return (q.meta?.tag ?? []).some((t) => t.system === PAPERWORK_FLOW_TYPE_SYSTEM);
}

// ── markers: base kind, mode, group ───────────────────────────────────────────

export function readServiceFlowBaseKind(q: Questionnaire): PaperworkFlowBaseKind {
  const code = (q.extension ?? []).find((e) => e.url === PAPERWORK_FLOW_BASE_EXTENSION_URL)?.valueCode;
  return code === 'consent-only' ? 'consent-only' : 'standard';
}

export function readServiceFlowMode(q: Questionnaire): PaperworkFlowMode | undefined {
  const code = (q.extension ?? []).find((e) => e.url === PAPERWORK_FLOW_MODE_EXTENSION_URL)?.valueCode;
  return code === 'in-person' || code === 'virtual' ? code : undefined;
}

/** The group slug shared by a service flow's mode variants (from the group identifier). */
export function getServiceFlowGroupSlug(q: Questionnaire): string | undefined {
  return (q.identifier ?? []).find((i) => i.system === PAPERWORK_FLOW_GROUP_SYSTEM)?.value;
}

// ── derivedFrom: base representative + forms ───────────────────────────────────

/** Raw derivedFrom canonicals (`url|version` strings) on a flow. */
export function getFlowDerivedFrom(q: Questionnaire): string[] {
  return (q.derivedFrom ?? []).filter((d): d is string => typeof d === 'string');
}

/**
 * The pinned base representative canonical (derivedFrom[0]) — the raw/base-flow intake this flow sits on.
 * Undefined for a consent-only service flow, which prepends no base intake.
 */
export function getFlowBaseRepresentative(q: Questionnaire): string | undefined {
  if (isServiceFlow(q) && readServiceFlowBaseKind(q) === 'consent-only') return undefined;
  return getFlowDerivedFrom(q)[0];
}

/** The attached practice-managed form canonicals — every derivedFrom entry after any pinned base at [0]. */
export function getFlowFormCanonicals(q: Questionnaire): string[] {
  const df = getFlowDerivedFrom(q);
  // A consent-only service flow has no pinned base at [0]; every entry is a form.
  if (isServiceFlow(q) && readServiceFlowBaseKind(q) === 'consent-only') return df;
  return df.slice(1);
}

/** Cascade helper: does this flow pin the given base representative at derivedFrom[0]? */
export function flowReferencesBaseRef(q: Questionnaire, canonicalWithVersion: string): boolean {
  return getFlowBaseRepresentative(q) === canonicalWithVersion;
}

// ── slug / mode ───────────────────────────────────────────────────────────────

export function getFlowSlug(q: Questionnaire): string | undefined {
  return q.url?.split('/').pop();
}

export function baseFlowMode(q: Questionnaire): PaperworkFlowMode | undefined {
  const slug = getFlowSlug(q);
  if (slug === BASE_INTAKE_FLOW_SLUG['in-person']) return 'in-person';
  if (slug === BASE_INTAKE_FLOW_SLUG.virtual) return 'virtual';
  return undefined;
}

// ── record parsing ─────────────────────────────────────────────────────────────

/** Parse a base intake flow Questionnaire into a card record. `resolveFormId` maps a derivedFrom
 *  canonical to the UI-facing practice-managed form id (unresolvable entries are dropped). */
export function toBaseIntakeFlowRecord(
  q: Questionnaire,
  resolveFormId: (canonical: string) => string | undefined
): BaseIntakeFlow | null {
  if (!isBaseIntakeFlow(q)) return null;
  const mode = baseFlowMode(q);
  const slug = getFlowSlug(q);
  if (!mode || !slug) return null;
  return {
    id: q.id,
    slug,
    name: q.title ?? slug,
    mode,
    url: q.url,
    version: q.version,
    status: q.status,
    formIds: getFlowFormCanonicals(q)
      .map(resolveFormId)
      .filter((id): id is string => !!id),
  };
}

/** Group a logical service flow's mode variants (all sharing one group slug) into a single record.
 *  Forms / base kind / name are read from any variant (they are identical across variants). */
export function toServiceFlowRecord(
  variants: Questionnaire[],
  resolveFormId: (canonical: string) => string | undefined
): ServiceFlow | null {
  const serviceVariants = variants.filter(isServiceFlow);
  if (serviceVariants.length === 0) return null;
  const groupSlug = getServiceFlowGroupSlug(serviceVariants[0]);
  if (!groupSlug) return null;
  const representative = serviceVariants[0];
  const modes = serviceVariants
    .map(readServiceFlowMode)
    .filter((m): m is PaperworkFlowMode => !!m)
    .sort();
  return {
    slug: groupSlug,
    name: representative.title ?? groupSlug,
    base: readServiceFlowBaseKind(representative),
    formIds: getFlowFormCanonicals(representative)
      .map(resolveFormId)
      .filter((id): id is string => !!id),
    modes: Array.from(new Set(modes)),
  };
}

// ── Questionnaire builders ───────────────────────────────────────────────────

/** Inputs for minting/refreshing a base intake flow Questionnaire. */
export interface BuildBaseIntakeFlowInput {
  id?: string;
  slug: string;
  name: string;
  version: string;
  status?: Questionnaire['status'];
  /** The raw mode intake canonical (`url|version`), pinned as derivedFrom[0]. */
  modeIntakeCanonical: string;
  /** Resolved `url|version` canonicals for the attached practice-managed forms, in order. */
  formCanonicals: string[];
}

export function buildBaseIntakeFlowQuestionnaire(input: BuildBaseIntakeFlowInput): Questionnaire {
  return {
    resourceType: 'Questionnaire',
    ...(input.id ? { id: input.id } : {}),
    url: makePaperworkFlowUrl(input.slug),
    version: input.version,
    name: input.slug,
    title: input.name,
    status: input.status ?? 'active',
    meta: { tag: [BASE_INTAKE_FLOW_TAG] },
    derivedFrom: [input.modeIntakeCanonical, ...input.formCanonicals],
  };
}

/** Inputs for minting/refreshing one mode variant of a logical service flow. */
export interface BuildServiceFlowVariantInput {
  id?: string;
  /** Group slug (shared identity across mode variants). */
  groupSlug: string;
  name: string;
  version: string;
  status?: Questionnaire['status'];
  base: PaperworkFlowBaseKind;
  mode: PaperworkFlowMode;
  /** The base representative canonical (`url|version`) for this mode, pinned as derivedFrom[0]. */
  baseRepresentative: string;
  /** Resolved `url|version` canonicals for the attached practice-managed forms, in order. */
  formCanonicals: string[];
}

export function buildServiceFlowVariantQuestionnaire(input: BuildServiceFlowVariantInput): Questionnaire {
  const extension: Extension[] = [
    { url: PAPERWORK_FLOW_BASE_EXTENSION_URL, valueCode: input.base },
    { url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: input.mode },
  ];
  const variantSlug = serviceFlowVariantSlug(input.groupSlug, input.mode);
  // For 'standard', the mode's base representative is pinned first; 'consent-only' has no base intake
  // (develop has no lite intake), so the flow's own forms stand alone.
  const derivedFrom =
    input.base === 'consent-only' || !input.baseRepresentative
      ? [...input.formCanonicals]
      : [input.baseRepresentative, ...input.formCanonicals];
  return {
    resourceType: 'Questionnaire',
    ...(input.id ? { id: input.id } : {}),
    url: makePaperworkFlowUrl(variantSlug),
    version: input.version,
    name: variantSlug,
    title: input.name,
    status: input.status ?? 'active',
    meta: { tag: [SERVICE_FLOW_TAG] },
    identifier: [{ system: PAPERWORK_FLOW_GROUP_SYSTEM, value: input.groupSlug }],
    extension,
    derivedFrom,
  };
}

// ── zambda I/O types (shared with the EHR api client) ─────────────────────────

export interface PaperworkFlowListOutput {
  baseFlows: BaseIntakeFlow[];
  flows: ServiceFlowWithServices[];
}

/** The editable shape of a logical service flow (as authored in the dialog). */
export interface ServiceFlowInput {
  /** Group slug — stable identity; auto-derived from the name, editable on create. */
  slug: string;
  name: string;
  base: PaperworkFlowBaseKind;
  formIds: string[];
}

export interface PaperworkFlowCreateInput {
  flow: ServiceFlowInput;
  serviceIds: string[];
}

export interface PaperworkFlowCreateOutput {
  flow: ServiceFlowWithServices;
}

export type PaperworkFlowUpdateInput =
  | { updateType: 'base-intake'; mode: PaperworkFlowMode; formIds: string[] }
  | { updateType: 'service-flow'; flow: ServiceFlowInput; serviceIds: string[] }
  | { updateType: 'retire'; slug: string };

export interface PaperworkFlowUpdateOutput {
  baseFlow?: BaseIntakeFlow;
  flow?: ServiceFlowWithServices;
  success?: boolean;
}
