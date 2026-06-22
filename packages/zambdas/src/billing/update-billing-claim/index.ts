import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Claim, Coverage, FhirResource, Location, Organization, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import {
  BillingPolicyHolderInput,
  BillingSubscriberRelationship,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_HCPCS,
  CODE_SYSTEM_ICD_10,
  CODE_SYSTEM_OYSTEHR_RCM_CMS1500_PROCEDURE_MODIFIER,
  CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE,
  FHIR_RESOURCE_NOT_FOUND,
  getPayerUrl,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  BillingFhirResource,
  buildAddress,
  buildDiagnosisSequence,
  buildSubscriberRelatedPerson,
  claimHasRealCoverage,
  createBillingClient,
  ensureClaimInsurance,
  fetchById,
  getClaimTypeCoding,
  prepareWorkingCopy,
  setCoverageRelationship,
  setNpi,
  setTaxId,
  setTaxonomy,
  sortClaimInsurance,
} from '../shared';
import { UpdateBillingClaimParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Only fields present in the request are touched.
async function performEffect(oystehr: Oystehr, params: UpdateBillingClaimParams): Promise<{ id: string | undefined }> {
  switch (params.resourceType) {
    case 'Claim':
      return attachClaimResources(oystehr, params);
    case 'Patient': {
      const patient = await fetchById<Patient>(oystehr, 'Patient', params.resourceId);
      const { fields } = params;
      applyName(patient, fields.firstName, fields.lastName);
      if (fields.dob !== undefined) patient.birthDate = fields.dob;
      if (fields.gender !== undefined) patient.gender = fields.gender as Patient['gender'];
      if (fields.address !== undefined) patient.address = [buildAddress(fields.address)];
      return save(oystehr, patient);
    }
    case 'Practitioner': {
      const practitioner = await fetchById<Practitioner>(oystehr, 'Practitioner', params.resourceId);
      const { fields } = params;
      applyName(practitioner, fields.firstName, fields.lastName);
      if (fields.npi !== undefined) setNpi(practitioner, fields.npi);
      if (fields.taxId !== undefined) setTaxId(practitioner, fields.taxId);
      if (fields.taxonomyCode !== undefined) setTaxonomy(practitioner, fields.taxonomyCode);
      return save(oystehr, practitioner);
    }
    case 'Coverage': {
      const coverage = await fetchById<Coverage>(oystehr, 'Coverage', params.resourceId);
      const { fields } = params;
      if (fields.subscriberId !== undefined) coverage.subscriberId = fields.subscriberId;
      if (fields.status !== undefined) coverage.status = fields.status;
      if (fields.relationship === undefined) return save(oystehr, coverage);
      return saveCoverageSubscriber(oystehr, coverage, params.resourceId, fields.relationship, fields.policyHolder);
    }
    case 'Location': {
      const location = await fetchById<Location>(oystehr, 'Location', params.resourceId);
      const { fields } = params;
      if (fields.name !== undefined) location.name = fields.name;
      if (fields.npi !== undefined) setNpi(location, fields.npi);
      if (fields.address !== undefined) location.address = buildAddress(fields.address);
      return save(oystehr, location);
    }
    case 'Organization': {
      const organization = await fetchById<Organization>(oystehr, 'Organization', params.resourceId);
      const { fields } = params;
      if (fields.name !== undefined) organization.name = fields.name;
      if (fields.npi !== undefined) setNpi(organization, fields.npi);
      if (fields.taxId !== undefined) setTaxId(organization, fields.taxId);
      if (fields.taxonomyCode !== undefined) setTaxonomy(organization, fields.taxonomyCode);
      return save(oystehr, organization);
    }
  }
}

// Mirror update-billing-coverage: relationship/policy-holder edits also create/update/delete the
// working-copy subscriber RelatedPerson, so the coverage and the person are written in one transaction.
async function saveCoverageSubscriber(
  oystehr: Oystehr,
  coverage: Coverage,
  coverageId: string,
  relationship: BillingSubscriberRelationship,
  policyHolder?: BillingPolicyHolderInput
): Promise<{ id: string | undefined }> {
  const patientId = coverage.beneficiary?.reference?.split('/')[1];
  if (!patientId) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  setCoverageRelationship(coverage, relationship);
  const currentRef = coverage.subscriber?.reference;
  const currentSubscriberId = currentRef?.startsWith('RelatedPerson/') ? currentRef.split('/')[1] : undefined;

  const pre: BatchInputRequest<BillingFhirResource>[] = [];
  const post: BatchInputRequest<BillingFhirResource>[] = [];
  if (relationship === 'Self' || !policyHolder) {
    coverage.subscriber = { reference: `Patient/${patientId}` };
    if (currentSubscriberId) post.push({ method: 'DELETE', url: `RelatedPerson/${currentSubscriberId}` });
  } else {
    const subscriber = buildSubscriberRelatedPerson(patientId, relationship, policyHolder);
    if (currentSubscriberId) {
      subscriber.id = currentSubscriberId;
      pre.push({ method: 'PUT', url: `RelatedPerson/${currentSubscriberId}`, resource: subscriber });
      coverage.subscriber = { reference: `RelatedPerson/${currentSubscriberId}` };
    } else {
      const urn = `urn:uuid:${randomUUID()}`;
      pre.push({ method: 'POST', url: '/RelatedPerson', resource: subscriber, fullUrl: urn });
      coverage.subscriber = { reference: urn };
    }
  }

  const requests: BatchInputRequest<BillingFhirResource>[] = [
    ...pre,
    { method: 'PUT', url: `Coverage/${coverageId}`, resource: coverage },
    ...post,
  ];
  await oystehr.fhir.transaction<BillingFhirResource>({ requests });
  return { id: coverageId };
}

// Working copy of the chosen original + claim reference, same wiring as create-billing-claim.
async function attachClaimResources(
  oystehr: Oystehr,
  params: Extract<UpdateBillingClaimParams, { resourceType: 'Claim' }>
): Promise<{ id: string | undefined }> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.resourceId);
  const { fields } = params;

  if (fields.type) {
    claim.type = getClaimTypeCoding(fields.type);
    const tags = [
      ...(claim.meta?.tag ?? []).filter((t) => t.system !== CODE_SYSTEM_CLAIM_TYPE),
      getClaimTypeCoding(fields.type),
    ];
    claim.meta ??= {};
    claim.meta.tag = tags;
  }

  if (fields.billingProvider) {
    const copy = await createCopy(oystehr, fields.billingProvider.type, fields.billingProvider.id);
    claim.provider = { reference: `${fields.billingProvider.type}/${copy.id}` };
  }

  if (fields.renderingProvider) {
    const copy = await createCopy(oystehr, fields.renderingProvider.type, fields.renderingProvider.id);
    claim.careTeam = [
      {
        sequence: 1,
        provider: { reference: `${fields.renderingProvider.type}/${copy.id}` },
        role: { coding: [{ system: CODE_SYSTEM_OYSTEHR_RCM_CMS1500_REFERRING_PROVIDER_TYPE, code: '82' }] },
      },
      ...(claim.careTeam ?? []).filter((member) => member.sequence !== 1),
    ];
    claim.item = claim.item?.map((item) => ({
      ...item,
      careTeamSequence: Array.from(new Set([1, ...(item.careTeamSequence ?? [])])),
    }));
  }

  if (fields.facilityId) {
    const copy = await createCopy(oystehr, 'Location', fields.facilityId);
    claim.facility = { reference: `Location/${copy.id}` };
  }

  if (fields.coverageId) {
    const original = await fetchById<Coverage>(oystehr, 'Coverage', fields.coverageId);
    const copy = prepareWorkingCopy<Coverage>(original, fields.coverageId);
    if (claim.patient?.reference) {
      copy.beneficiary = { reference: claim.patient.reference };
      copy.subscriber = { reference: claim.patient.reference };
      // Mirror the encounter path: copy the subscriber RelatedPerson so the policy holder is preserved.
      const subscriberRef = original.subscriber?.reference;
      if (subscriberRef?.startsWith('RelatedPerson/')) {
        const subscriber = await fetchById<RelatedPerson>(
          oystehr,
          'RelatedPerson',
          subscriberRef.replace('RelatedPerson/', '')
        );
        const subscriberCopy = prepareWorkingCopy<RelatedPerson>(subscriber, subscriber.id!);
        subscriberCopy.patient = { reference: claim.patient.reference };
        const createdSubscriber = await oystehr.fhir.create(subscriberCopy);
        copy.subscriber = { reference: `RelatedPerson/${createdSubscriber.id}` };
      }
    }
    const created = await oystehr.fhir.create(copy);
    // ensureClaimInsurance drops any no-coverage stub now that a real focal coverage is attached.
    claim.insurance = ensureClaimInsurance([
      { sequence: 1, focal: true, coverage: { reference: `Coverage/${created.id}` } },
      ...(claim.insurance ?? []).filter((i) => i.sequence !== 1),
    ]);
    const payerRef = created.payor?.[0]?.reference;
    if (payerRef) claim.insurer = { reference: payerRef };
  }

  if (fields.removeCoverage) {
    // Make the claim self-pay; ensureClaimInsurance restores the no-coverage stub below.
    claim.insurance = [];
    delete claim.insurer;
  }

  if (fields.payerId) {
    const payerUrl = getPayerUrl(fields.payerId);
    // A payer is only meaningful with a real coverage; a stub-only claim stays uninsured.
    if (claimHasRealCoverage(claim.insurance)) claim.insurer = { reference: payerUrl };
    const coverageRef = sortClaimInsurance(claim)[0]?.coverage?.reference;
    if (coverageRef?.startsWith('Coverage/')) {
      const coverage = await fetchById<Coverage>(oystehr, 'Coverage', coverageRef.replace('Coverage/', ''));
      coverage.payor = [{ reference: payerUrl }];
      await oystehr.fhir.update(coverage);
    }
  }

  if (fields.diagnoses) {
    const seen = new Set<string>();
    claim.diagnosis = fields.diagnoses
      .filter((dx) => {
        if (seen.has(dx.code)) return false;
        seen.add(dx.code);
        return true;
      })
      .map((dx, i) => ({
        sequence: i + 1,
        diagnosisCodeableConcept: { coding: [{ system: CODE_SYSTEM_ICD_10, code: dx.code, display: dx.display }] },
      }));
  }

  if (fields.serviceLines) {
    const diagnosisCount = claim.diagnosis?.length ?? 0;
    const hasRenderingProvider = (claim.careTeam ?? []).some((member) => member.sequence === 1);
    claim.item = fields.serviceLines.map((line, i) => ({
      sequence: i + 1,
      careTeamSequence: hasRenderingProvider ? [1] : undefined,
      diagnosisSequence: buildDiagnosisSequence(line.diagnosisPointers, diagnosisCount),
      productOrService: { coding: [{ system: CODE_SYSTEM_HCPCS, code: line.cptCode }] },
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
    claim.total = { value: fields.serviceLines.reduce((sum, l) => sum + l.charges, 0), currency: 'USD' };
  } else if (fields.diagnoses) {
    // Diagnoses changed without lines: re-point items whose pointers no longer exist.
    const diagnosisCount = claim.diagnosis?.length ?? 0;
    claim.item = claim.item?.map((item) => ({
      ...item,
      diagnosisSequence: buildDiagnosisSequence(item.diagnosisSequence, diagnosisCount),
    }));
  }

  // Guarantee the Claim.insurance invariant regardless of which fields changed: keep the no-coverage
  // stub when there's no real coverage, and re-add it if a coverage was ever removed.
  claim.insurance = ensureClaimInsurance(claim.insurance);

  return save(oystehr, claim);
}

async function createCopy(
  oystehr: Oystehr,
  resourceType: 'Practitioner' | 'Organization' | 'Location',
  resourceId: string
): Promise<FhirResource> {
  const original = await fetchById<Practitioner | Organization | Location>(oystehr, resourceType, resourceId);
  return oystehr.fhir.create(prepareWorkingCopy(original, resourceId));
}

async function save(oystehr: Oystehr, resource: FhirResource): Promise<{ id: string | undefined }> {
  const updated = await oystehr.fhir.update(resource);
  return { id: updated.id };
}

function applyName(resource: Patient | Practitioner, firstName?: string, lastName?: string): void {
  const name: { use: 'official'; given?: string[]; family?: string } = { use: 'official' };
  if (firstName !== undefined) name.given = [firstName];
  if (lastName !== undefined) name.family = lastName;
  if (name.given || name.family) resource.name = [name];
}
