import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Claim, Coverage, Location, Organization, Patient, Person, Practitioner, Resource } from 'fhir/r4b';
import {
  ClaimStatusValues,
  claimStatusValuesToTags,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_HCPCS,
  CODE_SYSTEM_ICD_10,
  CODE_SYSTEM_OYSTEHR_RCM_CMS1500_PROCEDURE_MODIFIER,
  CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE,
  CODE_SYSTEM_PROCESS_PRIORITY,
  FHIR_RESOURCE_NOT_FOUND,
  getResourcesFromBatchInlineRequests,
  InternalError,
  withArStageInitialization,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  buildDiagnosisSequence,
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  findRef,
  prepareWorkingCopy,
} from '../shared';
import { CreateClaimParams, validateRequestParameters } from './validateRequestParameters';

type BillingFhirResource = Patient | Coverage | Practitioner | Organization | Location;

// A claim's billing and rendering providers can each be a Practitioner or an Organization.
type ClaimProvider = Practitioner | Organization;

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

interface OriginalResources {
  patient: Patient;
  coverage?: Coverage;
  renderingProvider?: ClaimProvider;
  facility?: Location;
  billingProvider?: ClaimProvider;
}

async function performEffect(oystehr: Oystehr, params: CreateClaimParams): Promise<{ claimId: string }> {
  const originals = await readOriginals(oystehr, params);
  const copies = await createWorkingCopies(oystehr, originals);

  if (copies.patient?.id) {
    await linkPatientCopyViaPerson(oystehr, params.patientId, copies.patient.id);
  }

  const claim = buildClaim(copies, params);
  const created = await oystehr.fhir.create<Claim>(claim);

  return { claimId: created.id! };
}

async function readOriginals(oystehr: Oystehr, params: CreateClaimParams): Promise<OriginalResources> {
  const rp = params.renderingProvider;
  const bp = params.billingProvider;

  const searches: string[] = [`/Patient?_id=${params.patientId}`];
  if (params.coverageId) searches.push(`/Coverage?_id=${params.coverageId}`);
  if (rp) searches.push(`/${rp.type}?_id=${rp.id}`);
  if (params.facilityId) searches.push(`/Location?_id=${params.facilityId}`);
  if (bp) searches.push(`/${bp.type}?_id=${bp.id}`);

  const resources = await getResourcesFromBatchInlineRequests(oystehr, searches);

  const patient = findRef<Patient>(resources, `Patient/${params.patientId}`);
  if (!patient) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  const coverage = findRef<Coverage>(resources, params.coverageId ? `Coverage/${params.coverageId}` : undefined);
  const renderingProvider = findRef<ClaimProvider>(resources, rp ? `${rp.type}/${rp.id}` : undefined);
  const facility = findRef<Location>(resources, params.facilityId ? `Location/${params.facilityId}` : undefined);
  const billingProvider = findRef<ClaimProvider>(resources, bp ? `${bp.type}/${bp.id}` : undefined);
  return { patient, coverage, renderingProvider, facility, billingProvider };
}

async function createWorkingCopies(oystehr: Oystehr, originals: OriginalResources): Promise<OriginalResources> {
  const requests: BatchInputPostRequest<BillingFhirResource>[] = [];
  const order: string[] = [];

  const patientUrn = `urn:uuid:${randomUUID()}`;
  const patientCopy = prepareWorkingCopy<Patient>(originals.patient, originals.patient.id!);
  requests.push({ method: 'POST', url: '/Patient', resource: patientCopy, fullUrl: patientUrn });
  order.push('patient');

  if (originals.coverage) {
    const copy = prepareWorkingCopy<Coverage>(originals.coverage, originals.coverage.id!);
    copy.beneficiary = { reference: patientUrn };
    copy.subscriber = { reference: patientUrn };
    // payor is an Oystehr payer list URL kept from the original coverage
    requests.push({ method: 'POST', url: '/Coverage', resource: copy });
    order.push('coverage');
  }

  if (originals.renderingProvider) {
    const copy = prepareWorkingCopy<Practitioner | Organization>(
      originals.renderingProvider,
      originals.renderingProvider.id
    );
    requests.push({ method: 'POST', url: `/${copy.resourceType}`, resource: copy });
    order.push('renderingProvider');
  }
  if (originals.facility) {
    const copy = prepareWorkingCopy<Location>(originals.facility, originals.facility.id!);
    requests.push({ method: 'POST', url: '/Location', resource: copy });
    order.push('facility');
  }
  if (originals.billingProvider) {
    const copy = prepareWorkingCopy<Practitioner | Organization>(
      originals.billingProvider,
      originals.billingProvider.id
    );
    requests.push({ method: 'POST', url: `/${copy.resourceType}`, resource: copy });
    order.push('billingProvider');
  }

  const txResult = await oystehr.fhir.transaction<BillingFhirResource>({ requests });
  const entries = (txResult.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];

  if (entries.length !== order.length) throw InternalError;

  const copies: Partial<OriginalResources> = {};
  for (let i = 0; i < order.length; i++) {
    const expected = requests[i].url.replace('/', '');
    if (entries[i].resourceType !== expected) throw InternalError;
    copies[order[i] as keyof OriginalResources] = entries[i] as any;
  }

  return { patient: originals.patient, ...copies } as OriginalResources;
}

function buildClaim(copies: OriginalResources, params: CreateClaimParams): Claim {
  const now = new Date().toISOString().slice(0, 10);

  // Status indicators chosen at creation, with the AR stage's progress status auto-initialized.
  const statusTags = claimStatusValuesToTags(
    withArStageInitialization((params.statuses ?? {}) as Partial<ClaimStatusValues>)
  );

  const claim: Claim = {
    resourceType: 'Claim',
    status: 'draft',
    meta: { tag: [{ system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' }, ...statusTags] },
    type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: 'professional' }] },
    use: 'claim',
    created: now,
    patient: { reference: `Patient/${copies.patient.id}` },
    provider: copies.billingProvider?.id
      ? { reference: `${copies.billingProvider.resourceType}/${copies.billingProvider.id}` }
      : { display: 'Unknown' },
    priority: { coding: [{ system: CODE_SYSTEM_PROCESS_PRIORITY, code: 'normal' }] },
    insurance: [],
    diagnosis: [],
    item: [],
  };

  const payerRef = copies.coverage?.payor?.[0]?.reference;
  if (payerRef) claim.insurer = { reference: payerRef };
  if (copies.facility?.id) claim.facility = { reference: `Location/${copies.facility.id}` };
  if (copies.coverage?.id) {
    claim.insurance = [{ sequence: 1, focal: true, coverage: { reference: `Coverage/${copies.coverage.id}` } }];
  }

  if (copies.renderingProvider?.id) {
    claim.careTeam = [
      {
        sequence: 1,
        provider: { reference: `${copies.renderingProvider.resourceType}/${copies.renderingProvider.id}` },
        role: {
          coding: [{ system: CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE, code: '82' }],
        },
      },
    ];
  }

  if (params.diagnoses?.length) {
    const uniqueDiagnoses = new Set<string>();
    claim.diagnosis = params.diagnoses
      .filter((dx) => {
        if (uniqueDiagnoses.has(dx.code)) return false;
        uniqueDiagnoses.add(dx.code);
        return true;
      })
      .map((dx, i) => ({
        sequence: i + 1,
        diagnosisCodeableConcept: {
          coding: [{ system: CODE_SYSTEM_ICD_10, code: dx.code, display: dx.display }],
        },
      }));
  }

  if (params.serviceLines?.length) {
    const diagnosisCount = claim.diagnosis?.length ?? 0;
    claim.item = params.serviceLines.map((line, i) => ({
      sequence: i + 1,
      careTeamSequence: copies.renderingProvider ? [1] : undefined,
      diagnosisSequence: buildDiagnosisSequence(line.diagnosisPointers, diagnosisCount),
      productOrService: {
        coding: [{ system: CODE_SYSTEM_HCPCS, code: line.cptCode }],
      },
      modifier: line.modifiers?.length
        ? line.modifiers.map((m) => ({
            coding: [{ system: CODE_SYSTEM_OYSTEHR_RCM_CMS1500_PROCEDURE_MODIFIER, code: m }],
          }))
        : undefined,
      servicedPeriod: { start: line.serviceDate },
      locationCodeableConcept: line.placeOfService
        ? { coding: [{ system: CODE_SYSTEM_CMS_PLACE_OF_SERVICE, code: line.placeOfService }] }
        : undefined,
      net: { value: line.charges, currency: 'USD' },
      quantity: { value: line.units, unit: 'UN' },
    }));
    claim.total = { value: params.serviceLines.reduce((sum, l) => sum + l.charges, 0), currency: 'USD' };
  }

  return claim;
}

async function linkPatientCopyViaPerson(
  oystehr: Oystehr,
  originalPatientId: string,
  copyPatientId: string
): Promise<void> {
  const result = await oystehr.fhir.search<Person>({
    resourceType: 'Person',
    params: [{ name: 'link', value: `Patient/${originalPatientId}` }],
  });
  const existing = result.unbundle()[0];

  if (existing?.id) {
    const alreadyLinked = existing.link?.some((l) => l.target?.reference === `Patient/${copyPatientId}`);
    if (!alreadyLinked) {
      await oystehr.fhir.patch({
        resourceType: 'Person',
        id: existing.id,
        operations: [{ op: 'add', path: '/link/-', value: { target: { reference: `Patient/${copyPatientId}` } } }],
      });
    }
  } else {
    await oystehr.fhir.create<Person>({
      resourceType: 'Person',
      link: [
        { target: { reference: `Patient/${originalPatientId}` } },
        { target: { reference: `Patient/${copyPatientId}` } },
      ],
    });
  }
}
