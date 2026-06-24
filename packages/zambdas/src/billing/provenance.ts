import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import {
  Claim,
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
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER,
  CLAIM_RULES_ENGINE_DEVICE_NAME,
  CLAIM_STATUS_FIELDS,
  ClaimFieldChange,
  ClaimProvenanceActivityKey,
  ClaimProvenanceDiff,
  convertFhirNameToDisplayName,
  formatClaimStatusValue,
  getClaimStatusValues,
  getNPI,
  getTaxID,
  Secrets,
} from 'utils';
import { getMyPractitionerId } from '../shared/practitioners';
import { CLAIM_TAG_SYSTEM, fhirName, formatAddress, getClaimType, getTaxonomy, sortClaimInsurance } from './shared';

// ---------------------------------------------------------------------------
// Claim history (Provenance) helpers
//
// Every create/mutation of a Claim or one of its working-copy resources writes a Provenance in the
// same FHIR transaction as the change. This module builds those Provenances: a projection-based diff
// of the business fields (before vs after), the acting agent (human Practitioner or the rules-engine
// Device), and the activity coding.
// ---------------------------------------------------------------------------

type FieldProjection = { field: string; label: string; value: string };

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
  out.push(
    { field: 'diagnoses', label: 'Diagnoses', value: joinDiagnoses(claim) },
    { field: 'serviceLines', label: 'Service Lines', value: joinServiceLines(claim) },
    { field: 'totalCharges', label: 'Total Charges', value: claim.total?.value != null ? `$${claim.total.value}` : '' },
    { field: 'billingProvider', label: 'Billing Provider', value: refValue(claim.provider) },
    { field: 'renderingProvider', label: 'Rendering Provider', value: refValue(claim.careTeam?.[0]?.provider) },
    { field: 'facility', label: 'Service Facility', value: refValue(claim.facility) },
    { field: 'payer', label: 'Payer', value: refValue(claim.insurer) },
    {
      field: 'coverage',
      label: 'Coverage',
      value: sortClaimInsurance(claim)
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
    { field: 'payer', label: 'Payer', value: c.payor?.[0]?.reference ?? '' },
    {
      field: 'relationship',
      label: 'Relationship',
      value: c.relationship?.coding?.[0]?.display ?? c.relationship?.coding?.[0]?.code ?? '',
    },
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
 * null, so a field that is absent or blank on one side reads as a clean set/clear.
 */
export function diffResources(before: Resource | undefined, after: Resource | undefined): ClaimFieldChange[] {
  const merged = new Map<string, { label: string; previous: string | null; next: string | null }>();
  for (const p of before ? projectResource(before) : []) {
    merged.set(p.field, { label: p.label, previous: p.value, next: null });
  }
  for (const p of after ? projectResource(after) : []) {
    const existing = merged.get(p.field);
    if (existing) existing.next = p.value;
    else merged.set(p.field, { label: p.label, previous: null, next: p.value });
  }

  const changes: ClaimFieldChange[] = [];
  for (const [field, { label, previous, next }] of merged) {
    if ((previous ?? '') === (next ?? '')) continue;
    changes.push({
      field,
      label,
      previousValue: previous && previous !== '' ? previous : null,
      newValue: next && next !== '' ? next : null,
    });
  }
  return changes;
}

// --- Actor resolution -------------------------------------------------------

// Cached across warm invocations (per module scope), like the M2M token.
let rulesEngineDeviceId: string | undefined;

/**
 * Resolve (and lazily provision) the singleton Device representing the automated billing rules engine.
 */
export async function ensureRulesEngineDevice(oystehr: Oystehr): Promise<string> {
  if (rulesEngineDeviceId) return rulesEngineDeviceId;

  const existing = (
    await oystehr.fhir.search<Device>({
      resourceType: 'Device',
      params: [
        {
          name: 'identifier',
          value: `${CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER.system}|${CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER.value}`,
        },
      ],
    })
  ).unbundle()[0];

  if (existing?.id) {
    rulesEngineDeviceId = existing.id;
    return existing.id;
  }

  const created = await oystehr.fhir.create<Device>({
    resourceType: 'Device',
    identifier: [CLAIM_RULES_ENGINE_DEVICE_IDENTIFIER],
    deviceName: [{ name: CLAIM_RULES_ENGINE_DEVICE_NAME, type: 'user-friendly-name' }],
    status: 'active',
  });
  rulesEngineDeviceId = created.id!;
  return rulesEngineDeviceId;
}

/**
 * Resolve the acting agent for a billing mutation. A request carrying a user token is attributed to
 * that user's Practitioner; anything else (automated / no user token) is attributed to the rules-engine
 * Device. FHIR operations themselves still run on the M2M client — the header is identity-only.
 */
export async function resolveClaimActor(
  oystehr: Oystehr,
  authorizationHeader: string | undefined,
  secrets: Secrets | null
): Promise<ProvenanceAgent> {
  const token = authorizationHeader?.replace('Bearer ', '');
  if (token) {
    try {
      const practitionerId = await getMyPractitionerId(token, secrets);
      return {
        type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] },
        who: { reference: `Practitioner/${practitionerId}` },
      };
    } catch (err) {
      console.error('Could not resolve acting practitioner from token; attributing to rules engine', err);
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
  resourceType: string;
  // Reference to the changed resource. During a creating transaction this is the urn:uuid fullUrl,
  // which the server resolves to a literal reference.
  targetReference: string;
  before?: Resource;
  after?: Resource;
  agent: ProvenanceAgent;
  activity: ClaimProvenanceActivityKey;
  recorded: string;
  // Versioned reference of the prior version (e.g. Coverage/abc/_history/3), when known.
  priorVersionReference?: string;
}

/**
 * Build the POST request for a Provenance describing a single change. Returns null for an update whose
 * diff is empty (a no-op mutation gets no history entry). Creates/deletes always produce a record.
 */
export function claimProvenanceRequest(args: ClaimProvenanceArgs): BatchInputPostRequest<Provenance> | null {
  const changes = diffResources(args.before, args.after);
  // Creates/deletes are always worth recording; any other activity with no field change is a no-op
  // mutation and gets no history entry.
  if (args.activity !== 'create' && args.activity !== 'delete' && changes.length === 0) return null;

  const diff: ClaimProvenanceDiff = { resourceType: args.resourceType, changes };
  const provenance: Provenance = {
    resourceType: 'Provenance',
    target: [{ reference: args.targetReference }],
    recorded: args.recorded,
    activity: { coding: [CLAIM_PROVENANCE_ACTIVITY[args.activity]] },
    agent: [args.agent],
    ...(args.priorVersionReference
      ? { entity: [{ role: 'revision', what: { reference: args.priorVersionReference } }] }
      : {}),
    extension: [{ url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL, valueString: JSON.stringify(diff) }],
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

/**
 * Commit a single-resource mutation together with its Provenance in one atomic transaction. Used by
 * endpoints that would otherwise issue a bare update/patch. When the Provenance is null (no-op update)
 * the mutation is still applied.
 */
export async function commitWithProvenance(
  oystehr: Oystehr,
  mutation: BatchInputRequest<FhirResource>,
  provenance: BatchInputPostRequest<Provenance> | null
): Promise<void> {
  const requests: BatchInputRequest<FhirResource>[] = provenance
    ? [mutation, provenance as BatchInputRequest<FhirResource>]
    : [mutation];
  await oystehr.fhir.transaction<FhirResource>({ requests });
}
