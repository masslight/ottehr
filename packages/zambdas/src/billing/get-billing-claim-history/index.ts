import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Device, Location, Organization, Practitioner, Provenance } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCoding } from 'utils/lib/fhir/helpers';
import { isPayerUrl } from 'utils/lib/helpers/helpers';
import { getOptionalSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  CLAIM_HISTORY_RESOURCE_LABELS,
  CLAIM_PROVENANCE_ACTIVITY_CODES,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_AGENT_TYPE_SYSTEM,
  CLAIM_PROVENANCE_CHANGE_REF_URL,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
  CLAIM_RULES_ENGINE_DEVICE_NAME,
  ClaimFieldChange,
  ClaimHistoryEntry,
  ClaimHistoryLink,
  GetClaimHistoryResponse,
} from 'utils/lib/types/data/billing/claim-history';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { sendErrors } from '../../shared/errors';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  createBillingClient,
  fhirName,
  payerDisplay,
  resolvePayersByRef,
  resourceDisplayName,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../shared';
import { GetClaimHistoryParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-claim-history';

// Reference-typed fields that deep-link to a billing-app screen.
const FIELD_SCREEN: Record<string, ClaimHistoryLink['screen']> = {
  billingProvider: 'billing-providers',
  renderingProvider: 'rendering-providers',
  facility: 'service-facilities',
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(oystehr: Oystehr, params: GetClaimHistoryParams): Promise<GetClaimHistoryResponse> {
  const { claimId } = params;
  const environment = getOptionalSecret(SecretsKeys.ENVIRONMENT, params.secrets) ?? '';

  // Every claim-history Provenance targets the claim (in addition to the changed resource), so one
  // paginated search returns the complete history — including changes to working copies that were
  // later replaced or removed from the claim.
  const searchResults = await getAllFhirSearchPages<Provenance | Practitioner | Device>(
    {
      resourceType: 'Provenance',
      params: [
        { name: 'target', value: `Claim/${claimId}` },
        { name: '_include', value: 'Provenance:agent' },
      ],
    },
    oystehr
  );

  const provenances = searchResults.filter((r): r is Provenance => r.resourceType === 'Provenance');
  const agentsByRef = new Map<string, Practitioner | Device>();
  searchResults.forEach((r) => {
    if (r.resourceType === 'Practitioner' || r.resourceType === 'Device')
      agentsByRef.set(`${r.resourceType}/${r.id}`, r);
  });

  const entries: ClaimHistoryEntry[] = provenances
    .map((provenance) => toHistoryEntry(provenance, agentsByRef, environment))
    // Newest first. Sort here rather than relying on a server-side _sort on `recorded`.
    .sort((a, b) => (a.recorded < b.recorded ? 1 : a.recorded > b.recorded ? -1 : 0));

  await attachLinksAndFallbackNames(oystehr, entries);

  return { entries };
}

// Report a claim-history data anomaly to Sentry via the shared, env-guarded reporter. We degrade
// gracefully (never crash the view) but want observability that a Provenance we wrote isn't shaped
// as intended.
function reportAnomaly(message: string, environment: string, cause?: unknown): void {
  const error = cause instanceof Error ? new Error(message, { cause }) : new Error(message);
  void sendErrors(error, environment);
}

function parseChanges(provenance: Provenance, environment: string): ClaimFieldChange[] {
  const diffString = provenance.extension?.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)?.valueString;
  if (!diffString) return [];
  try {
    const parsed = JSON.parse(diffString);
    if (!Array.isArray(parsed)) {
      reportAnomaly(`Claim-history change set is not an array on Provenance/${provenance.id}`, environment);
      return [];
    }
    const changes = parsed as ClaimFieldChange[];
    attachEntityRefs(provenance, changes, environment);
    return changes;
  } catch (err) {
    // One malformed record shouldn't blank the whole history view, but we want to know it happened.
    reportAnomaly(`Malformed change set on Provenance/${provenance.id}`, environment, err);
    return [];
  }
}

// The raw references behind reference-typed changes are stored as Provenance.entity entries tagged
// with the linking extension ('<field>|<previous|new>|<index>' — see provenance.ts), so a creating
// transaction gets them rewritten from urn:uuid to the real ids. Reattach them onto the parsed
// changes, re-joining multi-ref fields with ', ' in index order (the same comma-joined form the
// diff JSON used to carry). Records written before this format keep their inline refs and carry no
// linked entities — an inline ref always wins.
function attachEntityRefs(provenance: Provenance, changes: ClaimFieldChange[], environment: string): void {
  const refsByFieldSide = new Map<string, string[]>();
  for (const entity of provenance.entity ?? []) {
    const marker = entity.extension?.find((e) => e.url === CLAIM_PROVENANCE_CHANGE_REF_URL)?.valueString;
    if (!marker) continue;
    const [field, side, indexString] = marker.split('|');
    const index = Number(indexString);
    const reference = entity.what?.reference;
    if (!reference || !field || (side !== 'previous' && side !== 'new') || !Number.isInteger(index) || index < 0) {
      reportAnomaly(`Malformed change-ref entity '${marker}' on Provenance/${provenance.id}`, environment);
      continue;
    }
    const key = `${field}|${side}`;
    const refs = refsByFieldSide.get(key) ?? [];
    refs[index] = reference;
    refsByFieldSide.set(key, refs);
  }
  if (refsByFieldSide.size === 0) return;

  const joinedRefs = (field: string, side: 'previous' | 'new'): string | undefined => {
    const refs = refsByFieldSide.get(`${field}|${side}`);
    return refs ? refs.filter(Boolean).join(', ') : undefined;
  };
  for (const change of changes) {
    if (!change.previousRef) {
      const previousRef = joinedRefs(change.field, 'previous');
      if (previousRef) change.previousRef = previousRef;
    }
    if (!change.newRef) {
      const newRef = joinedRefs(change.field, 'new');
      if (newRef) change.newRef = newRef;
    }
  }
}

function toHistoryEntry(
  provenance: Provenance,
  agentsByRef: Map<string, Practitioner | Device>,
  environment: string
): ClaimHistoryEntry {
  const activityCode = provenance.activity?.coding?.[0]?.code;
  // target[0] is the changed resource (the claim itself is appended as a second target).
  const targetRef = provenance.target?.[0]?.reference;
  // Take a human agent if it's present
  const agent =
    provenance.agent.find(
      (agent) =>
        getCoding(agent.type, CLAIM_PROVENANCE_AGENT_TYPE_SYSTEM)?.code === CLAIM_PROVENANCE_AGENT_TYPE.human.code
    ) ?? provenance.agent?.[0];
  const agentRef = agent?.who?.reference;

  // Our writer always sets these; a claim-history Provenance missing them is a real defect, not a
  // routine optional-field case — surface it rather than silently rendering blanks.
  const missing = [
    !provenance.recorded && 'recorded',
    !activityCode && 'activity.coding',
    !targetRef && 'target.reference',
    !agentRef && 'agent.who.reference',
  ].filter((f): f is string => !!f);
  if (missing.length > 0) {
    reportAnomaly(`Claim-history Provenance/${provenance.id} is missing: ${missing.join(', ')}`, environment);
  }

  const resourceType = targetRef?.split('/')[0] ?? '';
  const message = provenance.extension?.find((e) => e.url === CLAIM_PROVENANCE_NOTE_EXTENSION_URL)?.valueString;
  return {
    id: provenance.id ?? '',
    recorded: provenance.recorded ?? '',
    activity: activityDisplay(activityCode ?? '', resourceType),
    actor: {
      display: actorDisplay(agentsByRef.get(agentRef ?? ''), agentRef ?? ''),
      type: agent.type?.coding?.[0]?.code === 'system' ? 'system' : 'user',
    },
    changes: parseChanges(provenance, environment),
    ...(message ? { message } : {}),
  };
}

// Values are display strings captured at write time; this pass only (a) attaches screen links for
// provider/facility references (via the master resource behind each working copy) and (b) resolves a
// friendly name for any value whose display was missing at write time — stored as the raw reference
// by older records, as null (with the ref in a linked entity) by newer ones.
async function attachLinksAndFallbackNames(oystehr: Oystehr, entries: ClaimHistoryEntry[]): Promise<void> {
  const resourceIdsByType: Record<string, Set<string>> = {
    Practitioner: new Set(),
    Organization: new Set(),
    Location: new Set(),
  };
  const payerUrls = new Set<string>();

  const collectRef = (ref: string | undefined): void => {
    if (!ref) return;
    if (isPayerUrl(ref)) {
      payerUrls.add(ref);
      return;
    }
    const [type, id] = ref.split('/');
    if (id && resourceIdsByType[type]) resourceIdsByType[type].add(id);
  };

  for (const entry of entries) {
    for (const change of entry.changes) {
      collectRef(change.previousRef);
      collectRef(change.newRef);
    }
  }

  const resourcesByRef = new Map<string, Practitioner | Organization | Location>();
  await Promise.all([
    ...Object.keys(resourceIdsByType).map(async (type) => {
      const ids = [...resourceIdsByType[type]];
      if (ids.length === 0) return;
      const found = (
        await oystehr.fhir.search<Practitioner | Organization | Location>({
          resourceType: type as 'Practitioner' | 'Organization' | 'Location',
          params: [{ name: '_id', value: ids.join(',') }],
        })
      ).unbundle();
      found.forEach((r) => {
        if (r.id) resourcesByRef.set(`${r.resourceType}/${r.id}`, r);
      });
    }),
  ]);
  const payersByRef = await resolvePayersByRef(oystehr, [...payerUrls]);

  const enrich = (
    field: string,
    value: string | null,
    ref: string | undefined
  ): { value: string | null; link: ClaimHistoryLink | null } => {
    if (!ref) return { value, link: null };
    const displayMissing = value === ref || value == null;
    if (isPayerUrl(ref)) {
      const resolved = displayMissing ? payerDisplay(payersByRef.get(ref)) ?? value : value;
      return { value: resolved, link: null };
    }
    const resource = resourcesByRef.get(ref);
    const resolved = displayMissing && resource ? resourceDisplayName(resource) || value : value;
    const screen = FIELD_SCREEN[field];
    const linkId = resource ? sourceId(resource) ?? resource.id : undefined;
    return { value: resolved, link: screen && linkId ? { screen, id: linkId } : null };
  };

  for (const entry of entries) {
    for (const change of entry.changes) {
      if (!change.previousRef && !change.newRef) continue;
      const previous = enrich(change.field, change.previousValue, change.previousRef);
      const next = enrich(change.field, change.newValue, change.newRef);
      change.previousValue = previous.value;
      change.previousLink = previous.link;
      change.newValue = next.value;
      change.newLink = next.link;
    }
  }
}

// The master resource id behind a working copy (from its source-identifier extension), so links open
// the canonical record the provider / facility screens manage rather than the per-claim copy.
function sourceId(resource: Practitioner | Organization | Location): string | undefined {
  const ref = resource.extension?.find((e) => e.url === SOURCE_IDENTIFIER_SYSTEM)?.valueReference?.reference;
  if (!ref) return undefined;
  return ref.includes('/') ? ref.split('/')[1] : ref;
}

function activityDisplay(code: string, resourceType: string): string {
  const label = CLAIM_HISTORY_RESOURCE_LABELS[resourceType] ?? resourceType ?? 'Resource';
  switch (code) {
    case CLAIM_PROVENANCE_ACTIVITY_CODES.create:
      return `Create ${label}`;
    case CLAIM_PROVENANCE_ACTIVITY_CODES.update:
      return `Update ${label}`;
    case CLAIM_PROVENANCE_ACTIVITY_CODES.delete:
      return `Delete ${label}`;
    case CLAIM_PROVENANCE_ACTIVITY_CODES.statusChange:
      return 'Status change';
    case CLAIM_PROVENANCE_ACTIVITY_CODES.tagChange:
      return 'Tag change';
    case CLAIM_PROVENANCE_ACTIVITY_CODES.submit:
      return `Submit ${label}`;
    case CLAIM_PROVENANCE_ACTIVITY_CODES.note:
      return 'Note';
    default:
      return label;
  }
}

function actorDisplay(actor: Practitioner | Device | undefined, ref: string): string {
  if (!actor) return ref.startsWith('Device/') ? CLAIM_RULES_ENGINE_DEVICE_NAME : ref || 'Unknown';
  if (actor.resourceType === 'Practitioner') return fhirName(actor) || ref;
  return actor.deviceName?.[0]?.name ?? CLAIM_RULES_ENGINE_DEVICE_NAME;
}
