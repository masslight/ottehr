import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Claim, Coverage, Location, Organization, Patient, Person, Practitioner, Resource } from 'fhir/r4b';
import {
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
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  applyNameOverrides,
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  findRef,
  prepareWorkingCopy,
} from '../shared';
import { CreateClaimParams, validateRequestParameters } from './validateRequestParameters';

type BillingFhirResource = Patient | Coverage | Practitioner | Organization | Location;

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
  practitioner?: Practitioner;
  facility?: Location;
  billingProvider?: Organization;
}

async function performEffect(oystehr: Oystehr, params: CreateClaimParams): Promise<{ claimId: string }> {
  const originals = await readOriginals(oystehr, params);
  const copies = await createWorkingCopies(oystehr, originals, params);

  if (copies.patient?.id) {
    await linkPatientCopyViaPerson(oystehr, params.patientId, copies.patient.id);
  }

  const claim = buildClaim(copies, params);
  const created = await oystehr.fhir.create<Claim>(claim);

  return { claimId: created.id! };
}

async function readOriginals(oystehr: Oystehr, params: CreateClaimParams): Promise<OriginalResources> {
  const searches: string[] = [`/Patient?_id=${params.patientId}`];
  if (params.coverageId) searches.push(`/Coverage?_id=${params.coverageId}`);
  if (params.practitionerId) searches.push(`/Practitioner?_id=${params.practitionerId}`);
  if (params.facilityId) searches.push(`/Location?_id=${params.facilityId}`);
  if (params.billingProviderId) searches.push(`/Organization?_id=${params.billingProviderId}`);

  const resources = await getResourcesFromBatchInlineRequests(oystehr, searches);

  const patient = findRef<Patient>(resources, `Patient/${params.patientId}`);
  if (!patient) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  const coverage = findRef<Coverage>(resources, params.coverageId ? `Coverage/${params.coverageId}` : undefined);
  const practitioner = findRef<Practitioner>(
    resources,
    params.practitionerId ? `Practitioner/${params.practitionerId}` : undefined
  );
  const facility = findRef<Location>(resources, params.facilityId ? `Location/${params.facilityId}` : undefined);
  const billingProvider = findRef<Organization>(
    resources,
    params.billingProviderId ? `Organization/${params.billingProviderId}` : undefined
  );
  return { patient, coverage, practitioner, facility, billingProvider };
}

async function createWorkingCopies(
  oystehr: Oystehr,
  originals: OriginalResources,
  params: CreateClaimParams
): Promise<OriginalResources> {
  const requests: BatchInputPostRequest<BillingFhirResource>[] = [];
  const order: string[] = [];

  const patientUrn = `urn:uuid:${randomUUID()}`;
  let patientCopy = prepareWorkingCopy<Patient>(originals.patient, originals.patient.id!);
  patientCopy = applyPatientOverrides(patientCopy, params.patientOverrides);
  requests.push({ method: 'POST', url: '/Patient', resource: patientCopy, fullUrl: patientUrn });
  order.push('patient');

  if (originals.coverage) {
    const copy = prepareWorkingCopy<Coverage>(originals.coverage, originals.coverage.id!);
    if (params.coverageOverrides?.subscriberId) copy.subscriberId = params.coverageOverrides.subscriberId;
    copy.beneficiary = { reference: patientUrn };
    copy.subscriber = { reference: patientUrn };
    // payor is an Oystehr payer list URL kept from the original coverage
    requests.push({ method: 'POST', url: '/Coverage', resource: copy });
    order.push('coverage');
  }

  if (originals.practitioner) {
    let copy = prepareWorkingCopy<Practitioner>(originals.practitioner, originals.practitioner.id!);
    copy = applyPractitionerOverrides(copy, params.practitionerOverrides);
    requests.push({ method: 'POST', url: '/Practitioner', resource: copy });
    order.push('practitioner');
  }
  if (originals.facility) {
    const copy = prepareWorkingCopy<Location>(originals.facility, originals.facility.id!);
    if (params.facilityOverrides?.name) copy.name = params.facilityOverrides.name;
    if (params.facilityOverrides?.npi) applyNpiOverride(copy, params.facilityOverrides.npi);
    if (params.facilityOverrides?.address) {
      copy.address = { ...(copy.address ?? {}), line: [params.facilityOverrides.address] };
    }
    requests.push({ method: 'POST', url: '/Location', resource: copy });
    order.push('facility');
  }
  if (originals.billingProvider) {
    const copy = prepareWorkingCopy<Organization>(originals.billingProvider, originals.billingProvider.id!);
    if (params.billingProviderOverrides?.name) copy.name = params.billingProviderOverrides.name;
    if (params.billingProviderOverrides?.npi) applyNpiOverride(copy, params.billingProviderOverrides.npi);
    if (params.billingProviderOverrides?.tin) applyTinOverride(copy, params.billingProviderOverrides.tin);
    requests.push({ method: 'POST', url: '/Organization', resource: copy });
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

function applyPatientOverrides(patient: Patient, overrides?: CreateClaimParams['patientOverrides']): Patient {
  if (!overrides) return patient;
  let p = applyNameOverrides(patient, overrides);
  if (overrides.dob !== undefined) p = { ...p, birthDate: overrides.dob };
  if (overrides.gender !== undefined) p = { ...p, gender: overrides.gender as Patient['gender'] };
  return p;
}

function applyPractitionerOverrides(
  pract: Practitioner,
  overrides?: CreateClaimParams['practitionerOverrides']
): Practitioner {
  if (!overrides) return pract;
  const p = applyNameOverrides(pract, overrides);
  if (overrides.npi !== undefined) {
    const npiIdent = p.identifier?.find((id) => id.type?.coding?.some((c) => c.code === 'NPI'));
    if (npiIdent) npiIdent.value = overrides.npi;
  }
  return p;
}

function applyNpiOverride(
  resource: { identifier?: { type?: { coding?: { code?: string }[] }; value?: string }[] },
  npi: string
): void {
  const npiIdent = resource.identifier?.find((id) => id.type?.coding?.some((c) => c.code === 'NPI'));
  if (npiIdent) npiIdent.value = npi;
}

function applyTinOverride(
  resource: { identifier?: { type?: { coding?: { code?: string }[] }; value?: string }[] },
  tin: string
): void {
  const taxIdent = resource.identifier?.find((id) => id.type?.coding?.some((c) => c.code === 'TAX'));
  if (taxIdent) taxIdent.value = tin;
}

function buildClaim(copies: OriginalResources, params: CreateClaimParams): Claim {
  const now = new Date().toISOString().slice(0, 10);

  const claim: Claim = {
    resourceType: 'Claim',
    status: 'draft',
    meta: { tag: [{ system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' }] },
    type: { coding: [{ system: CODE_SYSTEM_CLAIM_TYPE, code: 'professional' }] },
    use: 'claim',
    created: now,
    patient: { reference: `Patient/${copies.patient.id}` },
    provider: copies.billingProvider?.id
      ? { reference: `Organization/${copies.billingProvider.id}` }
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

  if (copies.practitioner?.id) {
    claim.careTeam = [
      {
        sequence: 1,
        provider: { reference: `Practitioner/${copies.practitioner.id}` },
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
    claim.item = params.serviceLines.map((line, i) => ({
      sequence: i + 1,
      careTeamSequence: copies.practitioner ? [1] : undefined,
      diagnosisSequence: params.diagnoses?.length ? [1] : undefined,
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
