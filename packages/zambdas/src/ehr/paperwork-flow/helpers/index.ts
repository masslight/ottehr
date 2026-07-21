// Shared server logic for the paperwork-flow admin zambdas (OTR-2309).
//
// A logical service flow materializes as one Questionnaire per applicable visit mode (union of its
// assigned service categories' modes). All mode-variants share a group identifier so the UI regroups
// them into one flow. Editing a flow mints new versions (retiring the old); editing a base intake card
// cascades to the standard service-flow variants that pin it. Base intake cards are minted lazily —
// an empty card has no resource and standard flows fall back to the raw mode intake canonical.
import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { HealthcareService, Questionnaire } from 'fhir/r4b';
import {
  BASE_INTAKE_FLOW_SLUG,
  BASE_INTAKE_FLOW_TAG_CODE,
  BaseIntakeFlow,
  buildBaseIntakeFlowQuestionnaire,
  buildCanonical,
  buildServiceFlowVariantQuestionnaire,
  getAllFhirSearchPages,
  getFlowBaseRepresentative,
  getServiceCategoryModes,
  getServiceFlowGroupSlug,
  IN_PERSON_INTAKE_PAPERWORK_CANONICAL,
  makePaperworkFlowUrl,
  PAPERWORK_FLOW_BASE_VERSION,
  PAPERWORK_FLOW_MODES,
  PaperworkFlowBaseKind,
  PaperworkFlowMode,
  parsePaperworkFlowGroup,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  readServiceFlowBaseKind,
  readServiceFlowMode,
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_TAG,
  SERVICE_FLOW_TAG_CODE,
  serviceFlowVariantSlug,
  ServiceFlowWithServices,
  toBaseIntakeFlowRecord,
  toServiceFlowRecord,
  VIRTUAL_INTAKE_PAPERWORK_CANONICAL,
} from 'utils';
import { isLatestVersion, patchQuestionnaireVersion } from '../../practice-managed-questionnaire/helpers';

const BASE_INTAKE_FLOW_NAME: Record<PaperworkFlowMode, string> = {
  'in-person': 'In-person intake',
  virtual: 'Virtual intake',
};

const RAW_INTAKE_CANONICAL: Record<PaperworkFlowMode, string> = {
  'in-person': buildCanonical(IN_PERSON_INTAKE_PAPERWORK_CANONICAL.url, IN_PERSON_INTAKE_PAPERWORK_CANONICAL.version),
  virtual: buildCanonical(VIRTUAL_INTAKE_PAPERWORK_CANONICAL.url, VIRTUAL_INTAKE_PAPERWORK_CANONICAL.version),
};

// ── low-level searches ────────────────────────────────────────────────────────

async function searchByTag(oystehr: Oystehr, tagCode: string): Promise<Questionnaire[]> {
  return getAllFhirSearchPages<Questionnaire>(
    { resourceType: 'Questionnaire', params: [{ name: '_tag', value: tagCode }] },
    oystehr
  );
}

/** Reduce a set of Questionnaires to the latest non-retired version per canonical url. */
function latestNonRetiredByUrl(questionnaires: Questionnaire[]): Map<string, Questionnaire> {
  const byUrl = new Map<string, Questionnaire>();
  for (const q of questionnaires) {
    if (q.status === 'retired' || !q.url) continue;
    const current = byUrl.get(q.url);
    if (!current || isLatestVersion(q, current)) byUrl.set(q.url, q);
  }
  return byUrl;
}

export async function searchServiceCategoryHealthcareServices(oystehr: Oystehr): Promise<HealthcareService[]> {
  return getAllFhirSearchPages<HealthcareService>(
    { resourceType: 'HealthcareService', params: [{ name: '_tag', value: SERVICE_CATEGORY_TAG.code }] },
    oystehr
  );
}

// ── practice-managed forms index (canonical <-> ui id) ─────────────────────────

export interface FormsIndex {
  /** Resolve a derivedFrom canonical (`url|version`) to the UI-facing latest form id (by url). */
  resolveFormId: (canonical: string) => string | undefined;
  /** Resolve a UI-facing form id to its pinned `url|version` canonical (the latest version). */
  resolveFormCanonical: (id: string) => string | undefined;
}

export async function buildFormsIndex(oystehr: Oystehr): Promise<FormsIndex> {
  const forms = await searchByTag(oystehr, PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code);
  const latestByUrl = latestNonRetiredByUrl(forms);
  const idByUrl = new Map<string, string>();
  const canonicalById = new Map<string, string>();
  for (const q of latestByUrl.values()) {
    if (!q.id || !q.url) continue;
    idByUrl.set(q.url, q.id);
    canonicalById.set(q.id, buildCanonical(q.url, q.version));
  }
  return {
    resolveFormId: (canonical: string) => idByUrl.get(canonical.split('|')[0]),
    resolveFormCanonical: (id: string) => canonicalById.get(id),
  };
}

// ── base intake cards ───────────────────────────────────────────────────────

/** The latest non-retired base intake card Questionnaire for a mode, or undefined (lazy-minted). */
export async function getBaseCard(oystehr: Oystehr, mode: PaperworkFlowMode): Promise<Questionnaire | undefined> {
  const url = makePaperworkFlowUrl(BASE_INTAKE_FLOW_SLUG[mode]);
  const cards = latestNonRetiredByUrl(await searchByTag(oystehr, BASE_INTAKE_FLOW_TAG_CODE));
  return cards.get(url);
}

/** The current standard base representative for a mode: the base card canonical if the card exists,
 *  else the raw mode intake canonical. */
export function baseRepresentativeForMode(mode: PaperworkFlowMode, baseCard: Questionnaire | undefined): string {
  if (baseCard?.url) return buildCanonical(baseCard.url, baseCard.version);
  return RAW_INTAKE_CANONICAL[mode];
}

export async function listBaseFlows(oystehr: Oystehr, formsIndex: FormsIndex): Promise<BaseIntakeFlow[]> {
  const cards = latestNonRetiredByUrl(await searchByTag(oystehr, BASE_INTAKE_FLOW_TAG_CODE));
  return PAPERWORK_FLOW_MODES.map((mode) => {
    const card = cards.get(makePaperworkFlowUrl(BASE_INTAKE_FLOW_SLUG[mode]));
    const record = card ? toBaseIntakeFlowRecord(card, formsIndex.resolveFormId) : null;
    return (
      record ?? {
        slug: BASE_INTAKE_FLOW_SLUG[mode],
        name: BASE_INTAKE_FLOW_NAME[mode],
        mode,
        formIds: [],
      }
    );
  });
}

// ── service flows ─────────────────────────────────────────────────────────────

/** Latest non-retired service-flow variants, grouped by group slug. */
async function getServiceFlowVariantsByGroup(oystehr: Oystehr): Promise<Map<string, Questionnaire[]>> {
  const latest = latestNonRetiredByUrl(await searchByTag(oystehr, SERVICE_FLOW_TAG_CODE));
  const byGroup = new Map<string, Questionnaire[]>();
  for (const q of latest.values()) {
    const group = getServiceFlowGroupSlug(q);
    if (!group) continue;
    (byGroup.get(group) ?? byGroup.set(group, []).get(group)!).push(q);
  }
  return byGroup;
}

export async function listServiceFlows(oystehr: Oystehr, formsIndex: FormsIndex): Promise<ServiceFlowWithServices[]> {
  const [byGroup, services] = await Promise.all([
    getServiceFlowVariantsByGroup(oystehr),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  const serviceIdsByGroup = new Map<string, string[]>();
  for (const hs of services) {
    const group = parsePaperworkFlowGroup(hs);
    if (group && hs.id) (serviceIdsByGroup.get(group) ?? serviceIdsByGroup.set(group, []).get(group)!).push(hs.id);
  }

  const flows: ServiceFlowWithServices[] = [];
  for (const [group, variants] of byGroup) {
    const record = toServiceFlowRecord(variants, formsIndex.resolveFormId);
    if (record) flows.push({ ...record, serviceIds: serviceIdsByGroup.get(group) ?? [] });
  }
  return flows.sort((a, b) => a.name.localeCompare(b.name));
}

// ── mode computation ────────────────────────────────────────────────────────

/** The visit modes a flow should cover: the union of its assigned services' modes, or both when none. */
export async function computeDesiredModes(oystehr: Oystehr, serviceIds: string[]): Promise<PaperworkFlowMode[]> {
  if (serviceIds.length === 0) return [...PAPERWORK_FLOW_MODES];
  const services = await searchServiceCategoryHealthcareServices(oystehr);
  const wanted = new Set(serviceIds);
  const modes = new Set<PaperworkFlowMode>();
  for (const hs of services) {
    if (!hs.id || !wanted.has(hs.id)) continue;
    for (const m of getServiceCategoryModes(hs)) {
      const mode = String(m);
      if (mode === 'in-person' || mode === 'virtual') modes.add(mode);
    }
  }
  return modes.size > 0 ? PAPERWORK_FLOW_MODES.filter((m) => modes.has(m)) : [...PAPERWORK_FLOW_MODES];
}

// ── minting (version bump + retire) ────────────────────────────────────────────

/** Every version (any status) of a canonical url. */
async function getAllVersionsAtUrl(oystehr: Oystehr, url: string): Promise<Questionnaire[]> {
  return (
    await oystehr.fhir.search<Questionnaire>({ resourceType: 'Questionnaire', params: [{ name: 'url', value: url }] })
  ).unbundle();
}

function maxVersion(questionnaires: Questionnaire[]): string | undefined {
  let max: Questionnaire | undefined;
  for (const q of questionnaires) {
    if (!q.version) continue;
    if (!max || isLatestVersion(q, max)) max = q;
  }
  return max?.version;
}

/**
 * Mint the next version of a canonical url: bump from the highest existing version (any status — so
 * re-adding a previously-retired variant never collides), retire the currently-active version if any,
 * and create the new resource, in one transaction. Returns the newly-created resource.
 */
async function mintQuestionnaireVersion(
  oystehr: Oystehr,
  url: string,
  build: (version: string) => Questionnaire
): Promise<Questionnaire> {
  const versions = await getAllVersionsAtUrl(oystehr, url);
  const highest = maxVersion(versions);
  const next = build(highest ? patchQuestionnaireVersion(highest) : PAPERWORK_FLOW_BASE_VERSION);
  const active = versions.find((q) => q.status !== 'retired' && q.id);
  if (!active?.id) return oystehr.fhir.create<Questionnaire>(next);
  const patch: BatchInputPatchRequest<Questionnaire> = {
    method: 'PATCH',
    url: `Questionnaire/${active.id}`,
    operations: [{ op: 'replace', path: '/status', value: 'retired' }],
  };
  const post: BatchInputPostRequest<Questionnaire> = { method: 'POST', url: '/Questionnaire', resource: next };
  const res = (await oystehr.fhir.transaction<Questionnaire>({ requests: [patch, post] })).unbundle();
  const created = res.find((r) => r.url === next.url && r.version === next.version);
  if (!created) throw new Error(`Failed to mint ${next.url}|${next.version}`);
  return created;
}

/** Mint (create or version-bump) one mode variant of a service flow. */
export async function mintServiceFlowVariant(
  oystehr: Oystehr,
  args: {
    groupSlug: string;
    name: string;
    base: PaperworkFlowBaseKind;
    mode: PaperworkFlowMode;
    baseRepresentative: string | undefined;
    formCanonicals: string[];
  }
): Promise<Questionnaire> {
  const url = makePaperworkFlowUrl(serviceFlowVariantSlug(args.groupSlug, args.mode));
  return mintQuestionnaireVersion(oystehr, url, (version) =>
    buildServiceFlowVariantQuestionnaire({
      groupSlug: args.groupSlug,
      name: args.name,
      version,
      base: args.base,
      mode: args.mode,
      baseRepresentative: args.baseRepresentative ?? '',
      formCanonicals: args.formCanonicals,
    })
  );
}

/** Mint (create or version-bump) a base intake card. */
export async function mintBaseCard(
  oystehr: Oystehr,
  args: { mode: PaperworkFlowMode; formCanonicals: string[] }
): Promise<Questionnaire> {
  const url = makePaperworkFlowUrl(BASE_INTAKE_FLOW_SLUG[args.mode]);
  return mintQuestionnaireVersion(oystehr, url, (version) =>
    buildBaseIntakeFlowQuestionnaire({
      slug: BASE_INTAKE_FLOW_SLUG[args.mode],
      name: BASE_INTAKE_FLOW_NAME[args.mode],
      version,
      modeIntakeCanonical: RAW_INTAKE_CANONICAL[args.mode],
      formCanonicals: args.formCanonicals,
    })
  );
}

export async function retireQuestionnaire(oystehr: Oystehr, id: string): Promise<void> {
  await oystehr.fhir.patch<Questionnaire>({
    resourceType: 'Questionnaire',
    id,
    operations: [{ op: 'replace', path: '/status', value: 'retired' }],
  });
}

// ── cascade: base card change -> re-point standard service variants ────────────

/** After a base card's representative changes for a mode, re-mint the standard service-flow variants
 *  (of that mode) that pinned the old representative so they point at the new one. */
export async function cascadeBaseChange(
  oystehr: Oystehr,
  mode: PaperworkFlowMode,
  oldRepresentative: string,
  newRepresentative: string
): Promise<void> {
  if (oldRepresentative === newRepresentative) return;
  const byGroup = await getServiceFlowVariantsByGroup(oystehr);
  const targets: Questionnaire[] = [];
  for (const variants of byGroup.values()) {
    for (const variant of variants) {
      if (
        readServiceFlowMode(variant) === mode &&
        readServiceFlowBaseKind(variant) === 'standard' &&
        getFlowBaseRepresentative(variant) === oldRepresentative
      ) {
        targets.push(variant);
      }
    }
  }
  for (const previous of targets) {
    const groupSlug = getServiceFlowGroupSlug(previous);
    if (!groupSlug) continue;
    const formCanonicals = (previous.derivedFrom ?? []).filter((d): d is string => typeof d === 'string').slice(1); // drop the old base representative at [0]
    await mintServiceFlowVariant(oystehr, {
      groupSlug,
      name: previous.title ?? groupSlug,
      base: 'standard',
      mode,
      baseRepresentative: newRepresentative,
      formCanonicals,
    });
  }
}

// ── service-category stamp reconciliation (single-valued) ──────────────────────

/** Return a copy of the service-category HS with its config blob's paperworkFlowGroup set or cleared,
 *  preserving all other blob keys (reasonsForVisit / abbreviation). */
function withPaperworkFlowGroup(hs: HealthcareService, group: string | undefined): HealthcareService {
  const existing = hs.extension?.find((e) => e.url === SERVICE_CATEGORY_CONFIG_EXTENSION_URL)?.valueString;
  let blob: Record<string, unknown> = {};
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === 'object') blob = parsed as Record<string, unknown>;
    } catch {
      blob = {};
    }
  }
  if (group) blob.paperworkFlowGroup = group;
  else delete blob.paperworkFlowGroup;

  const otherExtensions = (hs.extension ?? []).filter((e) => e.url !== SERVICE_CATEGORY_CONFIG_EXTENSION_URL);
  const configExtension =
    Object.keys(blob).length > 0
      ? [{ url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL, valueString: JSON.stringify(blob) }]
      : [];
  const nextExtensions = [...otherExtensions, ...configExtension];
  return { ...hs, extension: nextExtensions.length > 0 ? nextExtensions : undefined };
}

/** Make exactly `desiredServiceIds` point at `group`. Single-valued: assigning a service here removes it
 *  from any other flow; a service that previously pointed here but is no longer desired is cleared. */
export async function reconcileFlowServiceAssignments(
  oystehr: Oystehr,
  group: string,
  desiredServiceIds: string[]
): Promise<void> {
  const services = await searchServiceCategoryHealthcareServices(oystehr);
  const desired = new Set(desiredServiceIds);
  const updates: HealthcareService[] = [];
  for (const hs of services) {
    if (!hs.id) continue;
    const current = parsePaperworkFlowGroup(hs);
    if (desired.has(hs.id) && current !== group) updates.push(withPaperworkFlowGroup(hs, group));
    else if (!desired.has(hs.id) && current === group) updates.push(withPaperworkFlowGroup(hs, undefined));
  }
  await Promise.all(updates.map((hs) => oystehr.fhir.update<HealthcareService>(hs)));
}

/** Detach every service currently assigned to `group` (used when a flow is retired). */
export async function clearFlowFromAllServices(oystehr: Oystehr, group: string): Promise<void> {
  const services = await searchServiceCategoryHealthcareServices(oystehr);
  const updates = services
    .filter((hs) => hs.id && parsePaperworkFlowGroup(hs) === group)
    .map((hs) => withPaperworkFlowGroup(hs, undefined));
  await Promise.all(updates.map((hs) => oystehr.fhir.update<HealthcareService>(hs)));
}

/** Fetch all latest non-retired variants of one logical service flow by group slug. */
export async function getServiceFlowVariants(oystehr: Oystehr, group: string): Promise<Questionnaire[]> {
  return (await getServiceFlowVariantsByGroup(oystehr)).get(group) ?? [];
}
