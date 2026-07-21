// Shared server logic for the paperwork-flow admin zambdas (OTR-2309).
//
// One flow == one Questionnaire (derivedFrom pins the selected practice-managed forms as url|version;
// a mode extension records which visit modes it targets). Editing a flow mints a new version and
// retires the old. Each assigned service-category HealthcareService is stamped, per targeted mode,
// with the flow's url|version in a dedicated extension — single-valued per mode, so assigning a
// service to a flow for a mode replaces any other flow in that slot.
import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { HealthcareService, Questionnaire } from 'fhir/r4b';
import {
  buildCanonical,
  buildFlowQuestionnaire,
  getAllFhirSearchPages,
  makePaperworkFlowUrl,
  PAPERWORK_FLOW_BASE_VERSION,
  PAPERWORK_FLOW_MODES,
  PaperworkFlowMode,
  parseCanonical,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  readFlowStamp,
  SERVICE_CATEGORY_TAG,
  SERVICE_FLOW_TAG_CODE,
  ServiceFlowWithServices,
  toServiceFlowRecord,
  withFlowStamp,
} from 'utils';
import { isLatestVersion, patchQuestionnaireVersion } from '../../practice-managed-questionnaire/helpers';

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

// ── flow queries ──────────────────────────────────────────────────────────────

/** The latest non-retired flow Questionnaire for a slug, or undefined. */
export async function getFlow(oystehr: Oystehr, slug: string): Promise<Questionnaire | undefined> {
  const url = makePaperworkFlowUrl(slug);
  return latestNonRetiredByUrl(await searchByTag(oystehr, SERVICE_FLOW_TAG_CODE)).get(url);
}

/** Derive a slug from a desired base, ensuring it's unique among existing flows (any status). */
export async function makeUniqueFlowSlug(oystehr: Oystehr, desired: string): Promise<string> {
  const used = new Set(
    (await searchByTag(oystehr, SERVICE_FLOW_TAG_CODE)).map((q) => q.url?.split('/').pop()).filter(Boolean)
  );
  const base = desired || 'flow';
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export async function listServiceFlows(oystehr: Oystehr, formsIndex: FormsIndex): Promise<ServiceFlowWithServices[]> {
  const [flowMap, services] = await Promise.all([
    (async () => latestNonRetiredByUrl(await searchByTag(oystehr, SERVICE_FLOW_TAG_CODE)))(),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  // flow url -> assigned service ids (a service is assigned if any of its mode stamps points at the flow)
  const serviceIdsByFlowUrl = new Map<string, Set<string>>();
  for (const hs of services) {
    if (!hs.id) continue;
    for (const mode of PAPERWORK_FLOW_MODES) {
      const stamp = readFlowStamp(hs, mode);
      if (!stamp) continue;
      const url = parseCanonical(stamp).url;
      if (!serviceIdsByFlowUrl.has(url)) serviceIdsByFlowUrl.set(url, new Set());
      serviceIdsByFlowUrl.get(url)!.add(hs.id);
    }
  }

  const flows: ServiceFlowWithServices[] = [];
  for (const q of flowMap.values()) {
    const record = toServiceFlowRecord(q, formsIndex.resolveFormId);
    if (record && q.url) flows.push({ ...record, serviceIds: [...(serviceIdsByFlowUrl.get(q.url) ?? [])] });
  }
  return flows.sort((a, b) => a.name.localeCompare(b.name));
}

// ── minting (version bump + retire) ────────────────────────────────────────────

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
 * Mint the next version of a flow url: bump from the highest existing version (any status), retire the
 * currently-active version if any, and create the new resource, in one transaction.
 */
export async function mintFlow(
  oystehr: Oystehr,
  args: { slug: string; name: string; modes: PaperworkFlowMode[]; formCanonicals: string[] }
): Promise<Questionnaire> {
  const url = makePaperworkFlowUrl(args.slug);
  const versions = await getAllVersionsAtUrl(oystehr, url);
  const highest = maxVersion(versions);
  const next = buildFlowQuestionnaire({
    slug: args.slug,
    name: args.name,
    version: highest ? patchQuestionnaireVersion(highest) : PAPERWORK_FLOW_BASE_VERSION,
    modes: args.modes,
    formCanonicals: args.formCanonicals,
  });
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

export async function retireQuestionnaire(oystehr: Oystehr, id: string): Promise<void> {
  await oystehr.fhir.patch<Questionnaire>({
    resourceType: 'Questionnaire',
    id,
    operations: [{ op: 'replace', path: '/status', value: 'retired' }],
  });
}

// ── service-category per-mode stamp reconciliation ──────────────────────────────

/**
 * Make exactly `serviceIds` × `modes` point at `flowCanonical`. Single-valued per mode: assigning a
 * service to this flow for a mode replaces any other flow in that slot; a slot that pointed at this
 * flow (matched by url) but is no longer desired is cleared.
 */
export async function reconcileFlowServiceStamps(
  oystehr: Oystehr,
  flowUrl: string,
  flowCanonical: string,
  modes: PaperworkFlowMode[],
  serviceIds: string[]
): Promise<void> {
  const services = await searchServiceCategoryHealthcareServices(oystehr);
  const desired = new Set(serviceIds);
  const updates: HealthcareService[] = [];
  for (const hs of services) {
    if (!hs.id) continue;
    let next = hs;
    for (const mode of PAPERWORK_FLOW_MODES) {
      const shouldHave = desired.has(hs.id) && modes.includes(mode);
      const current = readFlowStamp(next, mode);
      if (shouldHave) {
        if (current !== flowCanonical) next = withFlowStamp(next, mode, flowCanonical);
      } else if (current && parseCanonical(current).url === flowUrl) {
        next = withFlowStamp(next, mode, undefined);
      }
    }
    if (next !== hs) updates.push(next);
  }
  await Promise.all(updates.map((hs) => oystehr.fhir.update<HealthcareService>(hs)));
}

/** Detach every service pointing at `flowUrl` (any mode) — used when a flow is retired. */
export async function clearFlowFromAllServices(oystehr: Oystehr, flowUrl: string): Promise<void> {
  const services = await searchServiceCategoryHealthcareServices(oystehr);
  const updates: HealthcareService[] = [];
  for (const hs of services) {
    let next = hs;
    for (const mode of PAPERWORK_FLOW_MODES) {
      const current = readFlowStamp(next, mode);
      if (current && parseCanonical(current).url === flowUrl) next = withFlowStamp(next, mode, undefined);
    }
    if (next !== hs) updates.push(next);
  }
  await Promise.all(updates.map((hs) => oystehr.fhir.update<HealthcareService>(hs)));
}
