import Oystehr from '@oystehr/sdk';
import { HealthcareService, List } from 'fhir/r4b';
import {
  BASE_PAPERWORK_FLOWS,
  getAllFhirSearchPages,
  isBaseFlow,
  PAPERWORK_FLOW_TAG,
  PaperworkFlow,
  paperworkFlowToFhirList,
  parsePaperworkFlowId,
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_TAG,
  toPaperworkFlowRecord,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../shared';

let m2mToken: string;

export async function getClient(input: ZambdaInput): Promise<Oystehr> {
  if (!input.secrets) throw new Error('No secrets provided');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  return createOystehrClient(m2mToken, input.secrets);
}

/** A flow record plus the ids of the service categories currently assigned to it. */
export interface PaperworkFlowWithServices extends PaperworkFlow {
  serviceIds: string[];
}

export async function searchPaperworkFlowLists(oystehr: Oystehr): Promise<List[]> {
  return getAllFhirSearchPages<List>(
    {
      resourceType: 'List',
      params: [{ name: '_tag', value: PAPERWORK_FLOW_TAG.code }],
    },
    oystehr
  );
}

export async function searchServiceCategoryHealthcareServices(oystehr: Oystehr): Promise<HealthcareService[]> {
  return getAllFhirSearchPages<HealthcareService>(
    {
      resourceType: 'HealthcareService',
      params: [{ name: '_tag', value: SERVICE_CATEGORY_TAG.code }],
    },
    oystehr
  );
}

/**
 * Ensure the three fixed base flows (one per base intake canonical) exist, creating
 * any that are missing, and return their Lists. Idempotent — matches existing base
 * flows by canonical so reruns never duplicate. Base flows start with no forms.
 */
export async function ensureBaseFlows(oystehr: Oystehr): Promise<List[]> {
  const existing = (await searchPaperworkFlowLists(oystehr)).filter(isBaseFlow);
  const byCanonical = new Map(existing.map((l) => [toPaperworkFlowRecord(l)?.canonical, l]));
  const created = await Promise.all(
    BASE_PAPERWORK_FLOWS.filter((desc) => !byCanonical.has(desc.canonical)).map((desc) =>
      oystehr.fhir.create<List>(
        paperworkFlowToFhirList({
          slug: desc.slug,
          name: desc.title,
          base: desc.base,
          formIds: [],
          canonical: desc.canonical,
        })
      )
    )
  );
  for (const list of created) {
    byCanonical.set(toPaperworkFlowRecord(list)?.canonical, list);
  }
  // Return in catalog order so the admin UI renders in-person / virtual / consent-only consistently.
  return BASE_PAPERWORK_FLOWS.map((desc) => byCanonical.get(desc.canonical)).filter((l): l is List => l !== undefined);
}

/** Ensure + return the base flows as records (the canonical-bound form lists). */
export async function listBaseFlows(oystehr: Oystehr): Promise<PaperworkFlow[]> {
  const lists = await ensureBaseFlows(oystehr);
  return lists.map((l) => toPaperworkFlowRecord(l)).filter((r): r is PaperworkFlow => r !== null);
}

/** List every *service* flow (base flows excluded), each enriched with the service-category ids pointing at it. */
export async function listFlowsWithServices(oystehr: Oystehr): Promise<PaperworkFlowWithServices[]> {
  const [lists, services] = await Promise.all([
    searchPaperworkFlowLists(oystehr),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);
  const servicesByFlow = new Map<string, string[]>();
  for (const hs of services) {
    const flowId = parsePaperworkFlowId(hs);
    if (flowId && hs.id) servicesByFlow.set(flowId, [...(servicesByFlow.get(flowId) ?? []), hs.id]);
  }
  return lists
    .filter((l) => !isBaseFlow(l))
    .map((l) => {
      const record = toPaperworkFlowRecord(l);
      if (!record?.id) return null;
      return { ...record, serviceIds: servicesByFlow.get(record.id) ?? [] };
    })
    .filter((f): f is PaperworkFlowWithServices => f !== null);
}

/** Return a copy of the service-category HS with its config blob's paperworkFlowId set or cleared. */
function withPaperworkFlowId(hs: HealthcareService, flowId: string | undefined): HealthcareService {
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
  if (flowId) blob.paperworkFlowId = flowId;
  else delete blob.paperworkFlowId;

  const otherExtensions = (hs.extension ?? []).filter((e) => e.url !== SERVICE_CATEGORY_CONFIG_EXTENSION_URL);
  const configExtension =
    Object.keys(blob).length > 0
      ? [{ url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL, valueString: JSON.stringify(blob) }]
      : [];
  const nextExtensions = [...otherExtensions, ...configExtension];
  return { ...hs, extension: nextExtensions.length > 0 ? nextExtensions : undefined };
}

/**
 * Make exactly `desiredServiceIds` point at `flowId`: assign it to those not already pointing at it,
 * and clear it from any service that pointed at this flow but is no longer in the set. Because the
 * field is single-valued, assigning a service here inherently removes it from any other flow.
 */
export async function reconcileFlowServiceAssignments(
  oystehr: Oystehr,
  flowId: string,
  desiredServiceIds: string[]
): Promise<void> {
  const services = await searchServiceCategoryHealthcareServices(oystehr);
  const desired = new Set(desiredServiceIds);
  const updates: HealthcareService[] = [];
  for (const hs of services) {
    if (!hs.id) continue;
    const current = parsePaperworkFlowId(hs);
    if (desired.has(hs.id) && current !== flowId) {
      updates.push(withPaperworkFlowId(hs, flowId));
    } else if (!desired.has(hs.id) && current === flowId) {
      updates.push(withPaperworkFlowId(hs, undefined));
    }
  }
  await Promise.all(updates.map((hs) => oystehr.fhir.update<HealthcareService>(hs)));
}

/** Clear `flowId` from every service that points at it (used when a flow is deleted). */
export async function clearFlowFromAllServices(oystehr: Oystehr, flowId: string): Promise<void> {
  const services = await searchServiceCategoryHealthcareServices(oystehr);
  const updates = services
    .filter((hs) => hs.id && parsePaperworkFlowId(hs) === flowId)
    .map((hs) => withPaperworkFlowId(hs, undefined));
  await Promise.all(updates.map((hs) => oystehr.fhir.update<HealthcareService>(hs)));
}
