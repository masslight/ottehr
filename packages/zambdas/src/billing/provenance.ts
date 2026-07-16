import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import {
  Claim,
  Coding,
  Coverage,
  Device,
  FhirResource,
  Location,
  Organization,
  Patient,
  Practitioner,
  Provenance,
  ProvenanceAgent,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER,
  CLAIM_RULES_ENGINE_DEVICE_NAME,
  CLAIM_STATUS_FIELDS,
  ClaimFieldChange,
  ClaimProvenanceActivityKey,
  ClaimStatusFieldKey,
  convertFhirNameToDisplayName,
  formatClaimStatusValue,
  getCandidPlanTypeCodeFromCoverage,
  getClaimStatusValues,
  getNPI,
  getPatchBinary,
  getTaxID,
  makeOptimisticLockIfMatchHeader,
  removePrefix,
  Secrets,
  userMe,
} from 'utils';
import {
  buildUpdatedClaimStatusTags,
  CLAIM_TAG_SYSTEM,
  fhirName,
  formatAddress,
  getClaimType,
  getTaxonomy,
  sortClaimInsurance,
} from './shared';

// ---------------------------------------------------------------------------
// Claim history (Provenance) — design overview
//
// Every create/mutation of a Claim or one of its working-copy resources writes a Provenance in the
// same FHIR transaction as the change. Each Provenance targets BOTH the changed resource and the
// claim, so `Provenance?target=Claim/{id}` returns the claim's complete history even for working
// copies that were later replaced or removed. The field-level before/after diff is stored inline as
// an extension, with display names captured at write time; FHIR _history remains the source of truth.
// ---------------------------------------------------------------------------

// `ref` is set for reference-typed fields: it drives change detection (display-only differences are
// not changes) and lets the read API attach screen links / resolve names for values written without
// a display.
type FieldProjection = { field: string; label: string; value: string; ref?: string };

function refValue(ref?: { reference?: string; display?: string }): string {
  if (!ref) return '';
  return ref.display ?? ref.reference ?? '';
}

function joinDiagnoses(claim: Claim): string {
  return (claim.diagnosis ?? [])
    .map((dx) => dx.diagnosisCodeableConcept?.coding?.[0])
    .map((c) => [c?.code, c?.display].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('; ');
}

function joinServiceLines(claim: Claim): string {
  return (claim.item ?? [])
    .map((item) => {
      const cpt = item.productOrService?.coding?.[0]?.code ?? '';
      const units = item.quantity?.value;
      const charge = item.net?.value;
      return [cpt, units != null ? `x${units}` : '', charge != null ? `$${charge}` : ''].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join('; ');
}

function projectClaim(claim: Claim): FieldProjection[] {
  const out: FieldProjection[] = [
    { field: 'claimType', label: 'Claim Type', value: claim.type ? getClaimType(claim) : '' },
  ];
  const values = getClaimStatusValues(claim);
  for (const field of CLAIM_STATUS_FIELDS) {
    out.push({
      field: `status.${field.key}`,
      label: field.label,
      value: formatClaimStatusValue(field, values[field.key]),
    });
  }
  const rendering = claim.careTeam?.[0]?.provider;
  const sortedInsurance = sortClaimInsurance(claim);
  out.push(
    { field: 'diagnoses', label: 'Diagnoses', value: joinDiagnoses(claim) },
    { field: 'serviceLines', label: 'Service Lines', value: joinServiceLines(claim) },
    { field: 'totalCharges', label: 'Total Charges', value: claim.total?.value != null ? `$${claim.total.value}` : '' },
    {
      field: 'billingProvider',
      label: 'Billing Provider',
      value: refValue(claim.provider),
      ref: claim.provider?.reference,
    },
    { field: 'renderingProvider', label: 'Rendering Provider', value: refValue(rendering), ref: rendering?.reference },
    { field: 'facility', label: 'Service Facility', value: refValue(claim.facility), ref: claim.facility?.reference },
    { field: 'payer', label: 'Payer', value: refValue(claim.insurer), ref: claim.insurer?.reference },
    {
      field: 'coverage',
      label: 'Coverage',
      value: sortedInsurance
        .map((i) => refValue(i.coverage))
        .filter(Boolean)
        .join(', '),
      ref: sortedInsurance
        .map((i) => i.coverage?.reference)
        .filter(Boolean)
        .join(', '),
    },
    {
      field: 'tags',
      label: 'Tags',
      value: (claim.meta?.tag ?? [])
        .filter((t) => t.system === CLAIM_TAG_SYSTEM)
        .map((t) => t.code)
        .filter(Boolean)
        .join(', '),
    }
  );
  return out;
}

function projectCoverage(c: Coverage): FieldProjection[] {
  return [
    { field: 'memberId', label: 'Member ID', value: c.subscriberId ?? '' },
    { field: 'payer', label: 'Payer', value: refValue(c.payor?.[0]), ref: c.payor?.[0]?.reference },
    {
      field: 'relationship',
      label: 'Relationship',
      value: c.relationship?.coding?.[0]?.display ?? c.relationship?.coding?.[0]?.code ?? '',
    },
    { field: 'planType', label: 'Plan Type', value: getCandidPlanTypeCodeFromCoverage(c) ?? '' },
    { field: 'status', label: 'Status', value: c.status ?? '' },
  ];
}

function projectPatient(p: Patient): FieldProjection[] {
  return [
    { field: 'name', label: 'Name', value: fhirName(p) },
    { field: 'dob', label: 'Date of Birth', value: p.birthDate ?? '' },
    { field: 'gender', label: 'Gender', value: p.gender ?? '' },
    { field: 'address', label: 'Address', value: formatAddress(p.address?.[0]) },
  ];
}

function projectPractitioner(p: Practitioner): FieldProjection[] {
  return [
    { field: 'name', label: 'Name', value: fhirName(p) },
    { field: 'npi', label: 'NPI', value: getNPI(p) ?? '' },
    { field: 'taxId', label: 'Tax ID', value: getTaxID(p) ?? '' },
    { field: 'taxonomy', label: 'Taxonomy', value: getTaxonomy(p) },
  ];
}

function projectOrganization(o: Organization): FieldProjection[] {
  return [
    { field: 'name', label: 'Name', value: o.name ?? '' },
    { field: 'npi', label: 'NPI', value: getNPI(o) ?? '' },
    { field: 'taxId', label: 'Tax ID', value: getTaxID(o) ?? '' },
    { field: 'taxonomy', label: 'Taxonomy', value: getTaxonomy(o) },
  ];
}

function projectLocation(l: Location): FieldProjection[] {
  return [
    { field: 'name', label: 'Name', value: l.name ?? '' },
    { field: 'npi', label: 'NPI', value: getNPI(l) ?? '' },
    { field: 'address', label: 'Address', value: formatAddress(l.address) },
  ];
}

function projectRelatedPerson(r: RelatedPerson): FieldProjection[] {
  return [
    { field: 'name', label: 'Name', value: r.name?.[0] ? convertFhirNameToDisplayName(r.name[0]) : '' },
    { field: 'dob', label: 'Date of Birth', value: r.birthDate ?? '' },
    { field: 'gender', label: 'Gender', value: r.gender ?? '' },
    { field: 'address', label: 'Address', value: formatAddress(r.address?.[0]) },
  ];
}

function projectResource(resource: Resource): FieldProjection[] {
  switch (resource.resourceType) {
    case 'Claim':
      return projectClaim(resource as Claim);
    case 'Coverage':
      return projectCoverage(resource as Coverage);
    case 'Patient':
      return projectPatient(resource as Patient);
    case 'Practitioner':
      return projectPractitioner(resource as Practitioner);
    case 'Organization':
      return projectOrganization(resource as Organization);
    case 'Location':
      return projectLocation(resource as Location);
    case 'RelatedPerson':
      return projectRelatedPerson(resource as RelatedPerson);
    default:
      return [];
  }
}

/**
 * Field-level diff between two snapshots of the same resource, using business-field projections.
 * `before`/`after` undefined model creation/deletion respectively. Empty values are normalized to
 * null. Reference-typed fields compare by reference, so a display-only difference is not a change.
 */
export function diffResources(before: Resource | undefined, after: Resource | undefined): ClaimFieldChange[] {
  type Merged = { label: string; previous: string | null; next: string | null; previousRef?: string; newRef?: string };
  const merged = new Map<string, Merged>();
  for (const p of before ? projectResource(before) : []) {
    merged.set(p.field, { label: p.label, previous: p.value, next: null, previousRef: p.ref });
  }
  for (const p of after ? projectResource(after) : []) {
    const existing = merged.get(p.field);
    if (existing) {
      existing.next = p.value;
      existing.newRef = p.ref;
    } else {
      merged.set(p.field, { label: p.label, previous: null, next: p.value, newRef: p.ref });
    }
  }

  const changes: ClaimFieldChange[] = [];
  for (const [field, { label, previous, next, previousRef, newRef }] of merged) {
    const unchanged =
      previousRef || newRef ? (previousRef ?? '') === (newRef ?? '') : (previous ?? '') === (next ?? '');
    if (unchanged) continue;
    changes.push({
      field,
      label,
      previousValue: previous && previous !== '' ? previous : null,
      newValue: next && next !== '' ? next : null,
      ...(previousRef ? { previousRef } : {}),
      ...(newRef ? { newRef } : {}),
    });
  }
  return changes;
}

// --- Actor resolution -------------------------------------------------------

// Cached across warm invocations (per module scope), like the M2M token.
let rulesEngineDeviceId: string | undefined;

/**
 * Resolve (and lazily provision) the singleton Device representing the automated billing rules engine.
 * Uses a FHIR conditional create so concurrent cold starts cannot create duplicates.
 */
export async function ensureRulesEngineDevice(oystehr: Oystehr): Promise<string> {
  if (rulesEngineDeviceId) return rulesEngineDeviceId;

  const identifierToken = `${CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER.system}|${CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER.value}`;
  const tx = await oystehr.fhir.transaction<Device>({
    requests: [
      {
        method: 'POST',
        url: '/Device',
        resource: {
          resourceType: 'Device',
          identifier: [CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER],
          deviceName: [{ name: CLAIM_RULES_ENGINE_DEVICE_NAME, type: 'user-friendly-name' }],
          status: 'active',
        },
        ifNoneExist: [{ name: 'identifier', value: identifierToken }],
      },
    ],
  });
  let device = tx.entry?.[0]?.resource;
  if (!device?.id) {
    // Some servers return no body when the conditional create matched an existing resource.
    device = (
      await oystehr.fhir.search<Device>({
        resourceType: 'Device',
        params: [{ name: 'identifier', value: identifierToken }],
      })
    ).unbundle()[0];
  }
  if (!device?.id) throw new Error('Failed to resolve the rules-engine Device');
  rulesEngineDeviceId = device.id;
  return rulesEngineDeviceId;
}

/**
 * Resolve the acting agent for a billing mutation. FHIR operations run on the M2M client — the
 * Authorization header is identity-only. A caller with a Practitioner profile is the human actor;
 * an authenticated caller without one (M2M automation) is the rules-engine Device. A failure to
 * resolve the caller's identity throws: an audit record with a guessed actor is worse than a
 * retryable error.
 */
export async function resolveClaimActor(
  oystehr: Oystehr,
  authorizationHeader: string | undefined,
  secrets: Secrets | null
): Promise<ProvenanceAgent> {
  const token = authorizationHeader?.replace('Bearer ', '');
  if (token) {
    const user = await userMe(token, secrets);
    const practitionerId = user.profile ? removePrefix('Practitioner/', user.profile) : undefined;
    if (practitionerId) {
      return {
        type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] },
        who: { reference: `Practitioner/${practitionerId}` },
      };
    }
  }
  const deviceId = await ensureRulesEngineDevice(oystehr);
  return {
    type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.system] },
    who: { reference: `Device/${deviceId}` },
  };
}

// --- Provenance request building --------------------------------------------

export interface ClaimProvenanceArgs {
  // Reference to the changed resource. During a creating transaction this may be a urn:uuid fullUrl,
  // which the server resolves to a literal reference.
  targetReference: string;
  // Reference to the claim this change belongs to (may equal targetReference).
  claimReference: string;
  before?: Resource;
  after?: Resource;
  agent: ProvenanceAgent;
  activity: ClaimProvenanceActivityKey;
  recorded: string;
  // Versioned reference of the prior version (e.g. Coverage/abc/_history/3), when known.
  priorVersionReference?: string;
  // Additional change entries the projection diff can't see (e.g. policy-holder edits folded into
  // the owning Coverage's record).
  extraChanges?: ClaimFieldChange[];
}

// Activities that record an event rather than a mutation — always written, even with an empty diff.
const ALWAYS_RECORDED_ACTIVITIES: ReadonlySet<ClaimProvenanceActivityKey> = new Set(['create', 'delete', 'submit']);

/**
 * Build the POST request for a Provenance describing a single change. Returns null for an update
 * whose diff is empty (a no-op mutation gets no history entry); creates/deletes/submits always
 * produce a record. target[0] is the changed resource; the claim is appended as a second target.
 */
export function claimProvenanceRequest(args: ClaimProvenanceArgs): BatchInputPostRequest<Provenance> | null {
  const changes = [...diffResources(args.before, args.after), ...(args.extraChanges ?? [])];
  if (!ALWAYS_RECORDED_ACTIVITIES.has(args.activity) && changes.length === 0) return null;

  const target = [{ reference: args.targetReference }];
  if (args.claimReference !== args.targetReference) target.push({ reference: args.claimReference });

  const provenance: Provenance = {
    resourceType: 'Provenance',
    target,
    recorded: args.recorded,
    activity: { coding: [CLAIM_PROVENANCE_ACTIVITY[args.activity]] },
    agent: [args.agent],
    ...(args.priorVersionReference
      ? { entity: [{ role: 'revision', what: { reference: args.priorVersionReference } }] }
      : {}),
    extension: [{ url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL, valueString: JSON.stringify(changes) }],
  };
  return { method: 'POST', url: '/Provenance', resource: provenance };
}

/**
 * Versioned reference (Resource/{id}/_history/{versionId}) for a fetched resource, or undefined when
 * the version isn't known.
 */
export function versionedReference(resource: Resource | undefined): string | undefined {
  if (!resource?.id || !resource.meta?.versionId) return undefined;
  return `${resource.resourceType}/${resource.id}/_history/${resource.meta.versionId}`;
}

// UTC timestamp for Provenance.recorded.
export function recordedNow(): string {
  return DateTime.now().setZone('UTC').toString();
}

// --- Shared write-and-record guts --------------------------------------------
//
// Every mutation of a claim-graph resource goes through one of the helpers below so the write and
// its Provenance always travel in the same transaction — a new endpoint can't forget the record.

export interface ClaimResourceChange {
  // The mutated resource to write (its current state is the Provenance's "after").
  resource: FhirResource;
  // Snapshot fetched before mutating; omit only when the write is a create.
  before?: FhirResource;
  agent: ProvenanceAgent;
  claimReference: string;
  // Defaults to 'update'.
  activity?: ClaimProvenanceActivityKey;
  // Change entries the projection diff can't see (e.g. policy-holder edits folded into the Coverage).
  extraChanges?: ClaimFieldChange[];
}

/**
 * The PUT for a mutated claim-graph resource plus its Provenance, as transaction requests. Use this
 * when composing a larger transaction; use commitClaimResourceChange to commit directly.
 */
export function claimResourceChangeRequests(change: ClaimResourceChange): BatchInputRequest<FhirResource>[] {
  const { resource, before, agent, claimReference, activity, extraChanges } = change;
  const provenance = claimProvenanceRequest({
    targetReference: `${resource.resourceType}/${resource.id}`,
    claimReference,
    before,
    after: resource,
    agent,
    activity: activity ?? 'update',
    recorded: recordedNow(),
    priorVersionReference: versionedReference(before),
    extraChanges,
  });
  return [
    { method: 'PUT', url: `${resource.resourceType}/${resource.id}`, resource },
    ...(provenance ? [provenance as BatchInputRequest<FhirResource>] : []),
  ];
}

/**
 * Commit a claim-graph resource mutation and its Provenance in one atomic transaction, optionally
 * with other requests that must ride along (e.g. a subscriber create/delete).
 */
export async function commitClaimResourceChange(
  oystehr: Oystehr,
  change: ClaimResourceChange & {
    preRequests?: BatchInputRequest<FhirResource>[];
    postRequests?: BatchInputRequest<FhirResource>[];
  }
): Promise<{ id: string | undefined }> {
  const requests: BatchInputRequest<FhirResource>[] = [
    ...(change.preRequests ?? []),
    ...claimResourceChangeRequests(change),
    ...(change.postRequests ?? []),
  ];
  await oystehr.fhir.transaction<FhirResource>({ requests });
  return { id: change.resource.id };
}

/**
 * Patch a claim's full meta.tag array (with optimistic locking) and record the change as a
 * Provenance, atomically. Shared by set-billing-claim-status and tag-billing-claim.
 */
export async function commitClaimMetaTagsWithProvenance(
  oystehr: Oystehr,
  claim: Claim,
  updatedTags: Coding[],
  activity: Extract<ClaimProvenanceActivityKey, 'statusChange' | 'tagChange'>,
  agent: ProvenanceAgent
): Promise<void> {
  const claimReference = `Claim/${claim.id}`;
  const afterClaim: Claim = { ...claim, meta: { ...claim.meta, tag: updatedTags } };
  const provenance = claimProvenanceRequest({
    targetReference: claimReference,
    claimReference,
    before: claim,
    after: afterClaim,
    agent,
    activity,
    recorded: recordedNow(),
    priorVersionReference: versionedReference(claim),
  });
  const patch = getPatchBinary({
    resourceType: 'Claim',
    resourceId: claim.id!,
    patchOperations: [{ op: 'add', path: '/meta/tag', value: updatedTags }],
    ifMatch: makeOptimisticLockIfMatchHeader(claim),
  });
  const requests: BatchInputRequest<FhirResource>[] = [patch, ...(provenance ? [provenance] : [])];
  await oystehr.fhir.transaction<FhirResource>({ requests });
}

/**
 * Record a claim's submission to the payer as its own Provenance. The submission is an event, not a
 * resource mutation, so it is written on its own rather than riding along with the follow-up status
 * change — a status write that fails or diffs to a no-op (e.g. a re-submission) must not erase the
 * record of who submitted the claim.
 */
export async function recordClaimSubmission(oystehr: Oystehr, claim: Claim, agent: ProvenanceAgent): Promise<void> {
  const claimReference = `Claim/${claim.id}`;
  const request = claimProvenanceRequest({
    targetReference: claimReference,
    claimReference,
    agent,
    activity: 'submit',
    recorded: recordedNow(),
  });
  if (!request) throw new Error(`Failed to build the submission Provenance for ${claimReference}`);
  await oystehr.fhir.transaction<Provenance>({ requests: [request] });
}

/**
 * Set (or clear) one claim-status field and record the change, atomically. The provenance-aware
 * counterpart of shared.ts#buildUpdatedClaimStatusTags, used by every endpoint that moves a claim's
 * status (set-billing-claim-status, submit-billing-claim, ...).
 */
export async function applyClaimStatusField(
  oystehr: Oystehr,
  claim: Claim,
  field: ClaimStatusFieldKey,
  value: string,
  agent: ProvenanceAgent
): Promise<void> {
  const updatedTags = buildUpdatedClaimStatusTags(claim, field, value);
  await commitClaimMetaTagsWithProvenance(oystehr, claim, updatedTags, 'statusChange', agent);
}
