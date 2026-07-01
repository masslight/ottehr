import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  Claim,
  Coverage,
  FhirResource,
  Location,
  Organization,
  Patient,
  Practitioner,
  ProvenanceAgent,
  RelatedPerson,
} from 'fhir/r4b';
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
import { claimProvenanceRequest, diffResources, resolveClaimActor, versionedReference } from '../provenance';
import {
  buildAddress,
  buildDiagnosisSequence,
  buildSubscriberRelatedPerson,
  claimHasRealCoverage,
  createBillingClient,
  ensureClaimInsurance,
  fetchById,
  getClaimTypeCoding,
  payerDisplay,
  prepareWorkingCopy,
  resolvePayersByRef,
  resourceDisplayName,
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
  const agent = await resolveClaimActor(oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Only fields present in the request are touched. Each branch snapshots the resource before mutating
// so the change can be recorded as a Provenance written in the same transaction as the update.
async function performEffect(
  oystehr: Oystehr,
  params: UpdateBillingClaimParams,
  agent: ProvenanceAgent
): Promise<{ id: string | undefined }> {
  const claimReference = `Claim/${params.claimId}`;
  switch (params.resourceType) {
    case 'Claim':
      return attachClaimResources(oystehr, params, agent);
    case 'Patient': {
      const patient = await fetchById<Patient>(oystehr, 'Patient', params.resourceId);
      const before = structuredClone(patient);
      const { fields } = params;
      applyName(patient, fields.firstName, fields.lastName);
      if (fields.dob !== undefined) patient.birthDate = fields.dob;
      if (fields.gender !== undefined) patient.gender = fields.gender as Patient['gender'];
      if (fields.address !== undefined) patient.address = [buildAddress(fields.address)];
      return save(oystehr, patient, before, agent, claimReference);
    }
    case 'Practitioner': {
      const practitioner = await fetchById<Practitioner>(oystehr, 'Practitioner', params.resourceId);
      const before = structuredClone(practitioner);
      const { fields } = params;
      applyName(practitioner, fields.firstName, fields.lastName);
      if (fields.npi !== undefined) setNpi(practitioner, fields.npi);
      if (fields.taxId !== undefined) setTaxId(practitioner, fields.taxId);
      if (fields.taxonomyCode !== undefined) setTaxonomy(practitioner, fields.taxonomyCode);
      return save(oystehr, practitioner, before, agent, claimReference);
    }
    case 'Coverage': {
      const coverage = await fetchById<Coverage>(oystehr, 'Coverage', params.resourceId);
      const before = structuredClone(coverage);
      const { fields } = params;
      if (fields.subscriberId !== undefined) coverage.subscriberId = fields.subscriberId;
      if (fields.status !== undefined) coverage.status = fields.status;
      if (fields.relationship === undefined) return save(oystehr, coverage, before, agent, claimReference);
      return saveCoverageSubscriber(
        oystehr,
        coverage,
        params.resourceId,
        fields.relationship,
        before,
        agent,
        claimReference,
        fields.policyHolder
      );
    }
    case 'Location': {
      const location = await fetchById<Location>(oystehr, 'Location', params.resourceId);
      const before = structuredClone(location);
      const { fields } = params;
      if (fields.name !== undefined) location.name = fields.name;
      if (fields.npi !== undefined) setNpi(location, fields.npi);
      if (fields.address !== undefined) location.address = buildAddress(fields.address);
      return save(oystehr, location, before, agent, claimReference);
    }
    case 'Organization': {
      const organization = await fetchById<Organization>(oystehr, 'Organization', params.resourceId);
      const before = structuredClone(organization);
      const { fields } = params;
      if (fields.name !== undefined) organization.name = fields.name;
      if (fields.npi !== undefined) setNpi(organization, fields.npi);
      if (fields.taxId !== undefined) setTaxId(organization, fields.taxId);
      if (fields.taxonomyCode !== undefined) setTaxonomy(organization, fields.taxonomyCode);
      return save(oystehr, organization, before, agent, claimReference);
    }
  }
}

// Mirror update-billing-coverage: relationship/policy-holder edits also create/update/delete the
// working-copy subscriber RelatedPerson, so the coverage and the person are written in one transaction.
// Policy-holder edits are recorded as `policyHolder.*` change entries on the Coverage's Provenance.
async function saveCoverageSubscriber(
  oystehr: Oystehr,
  coverage: Coverage,
  coverageId: string,
  relationship: BillingSubscriberRelationship,
  before: Coverage,
  agent: ProvenanceAgent,
  claimReference: string,
  policyHolder?: BillingPolicyHolderInput
): Promise<{ id: string | undefined }> {
  const patientId = coverage.beneficiary?.reference?.split('/')[1];
  if (!patientId) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  setCoverageRelationship(coverage, relationship);
  const currentRef = coverage.subscriber?.reference;
  const currentSubscriberId = currentRef?.startsWith('RelatedPerson/') ? currentRef.split('/')[1] : undefined;
  const currentSubscriber = currentSubscriberId
    ? await fetchById<RelatedPerson>(oystehr, 'RelatedPerson', currentSubscriberId)
    : undefined;

  const pre: BatchInputRequest<FhirResource>[] = [];
  const post: BatchInputRequest<FhirResource>[] = [];
  let newSubscriber: RelatedPerson | undefined;
  if (relationship === 'Self' || !policyHolder) {
    coverage.subscriber = { reference: `Patient/${patientId}` };
    if (currentSubscriberId) post.push({ method: 'DELETE', url: `RelatedPerson/${currentSubscriberId}` });
  } else {
    newSubscriber = buildSubscriberRelatedPerson(patientId, relationship, policyHolder);
    if (currentSubscriberId) {
      newSubscriber.id = currentSubscriberId;
      pre.push({ method: 'PUT', url: `RelatedPerson/${currentSubscriberId}`, resource: newSubscriber });
      coverage.subscriber = { reference: `RelatedPerson/${currentSubscriberId}` };
    } else {
      const urn = `urn:uuid:${randomUUID()}`;
      pre.push({ method: 'POST', url: '/RelatedPerson', resource: newSubscriber, fullUrl: urn });
      coverage.subscriber = { reference: urn };
    }
  }

  const policyHolderChanges = diffResources(currentSubscriber, newSubscriber).map((change) => ({
    ...change,
    field: `policyHolder.${change.field}`,
    label: `Policy Holder ${change.label}`,
  }));

  const provenance = claimProvenanceRequest({
    targetReference: `Coverage/${coverageId}`,
    claimReference,
    before,
    after: coverage,
    agent,
    activity: 'update',
    recorded: new Date().toISOString(),
    priorVersionReference: versionedReference(before),
    extraChanges: policyHolderChanges,
  });

  const requests: BatchInputRequest<FhirResource>[] = [
    ...pre,
    { method: 'PUT', url: `Coverage/${coverageId}`, resource: coverage },
    ...post,
    ...(provenance ? [provenance as BatchInputRequest<FhirResource>] : []),
  ];
  await oystehr.fhir.transaction<FhirResource>({ requests });
  return { id: coverageId };
}

// Working copy of the chosen original + claim reference, same wiring as create-billing-claim.
async function attachClaimResources(
  oystehr: Oystehr,
  params: Extract<UpdateBillingClaimParams, { resourceType: 'Claim' }>,
  agent: ProvenanceAgent
): Promise<{ id: string | undefined }> {
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.resourceId);
  const before = structuredClone(claim);
  const { fields } = params;
  const claimReference = `Claim/${params.resourceId}`;
  // Side-effect writes (e.g. re-pointing the attached coverage's payer) and their Provenances commit
  // in the same transaction as the claim update.
  const extraRequests: BatchInputRequest<FhirResource>[] = [];

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
    claim.provider = { reference: `${fields.billingProvider.type}/${copy.id}`, display: resourceDisplayName(copy) };
  }

  if (fields.renderingProvider) {
    const copy = await createCopy(oystehr, fields.renderingProvider.type, fields.renderingProvider.id);
    claim.careTeam = [
      {
        sequence: 1,
        provider: { reference: `${fields.renderingProvider.type}/${copy.id}`, display: resourceDisplayName(copy) },
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
    claim.facility = { reference: `Location/${copy.id}`, display: resourceDisplayName(copy) };
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
    const payerRef = created.payor?.[0]?.reference;
    const display = payerRef ? payerDisplay((await resolvePayersByRef(oystehr, [payerRef])).get(payerRef)) : undefined;
    // ensureClaimInsurance drops any no-coverage stub now that a real focal coverage is attached.
    claim.insurance = ensureClaimInsurance([
      { sequence: 1, focal: true, coverage: { reference: `Coverage/${created.id}`, display } },
      ...(claim.insurance ?? []).filter((i) => i.sequence !== 1),
    ]);
    if (payerRef) claim.insurer = { reference: payerRef, display };
  }

  if (fields.removeCoverage) {
    // Make the claim self-pay; ensureClaimInsurance restores the no-coverage stub below.
    claim.insurance = [];
    delete claim.insurer;
  }

  if (fields.payerId) {
    const payerUrl = getPayerUrl(fields.payerId);
    const display = payerDisplay(await oystehr.rcm.getPayer({ id: fields.payerId }));
    // A payer is only meaningful with a real coverage; a stub-only claim stays uninsured.
    if (claimHasRealCoverage(claim.insurance)) claim.insurer = { reference: payerUrl, display };
    const firstInsurance = sortClaimInsurance(claim)[0];
    const coverageRef = firstInsurance?.coverage?.reference;
    if (coverageRef?.startsWith('Coverage/')) {
      const coverage = await fetchById<Coverage>(oystehr, 'Coverage', coverageRef.replace('Coverage/', ''));
      const coverageBefore = structuredClone(coverage);
      coverage.payor = [{ reference: payerUrl, display }];
      if (firstInsurance.coverage) firstInsurance.coverage.display = display;
      extraRequests.push({ method: 'PUT', url: `Coverage/${coverage.id}`, resource: coverage });
      const coverageProvenance = claimProvenanceRequest({
        targetReference: `Coverage/${coverage.id}`,
        claimReference,
        before: coverageBefore,
        after: coverage,
        agent,
        activity: 'update',
        recorded: new Date().toISOString(),
        priorVersionReference: versionedReference(coverageBefore),
      });
      if (coverageProvenance) extraRequests.push(coverageProvenance as BatchInputRequest<FhirResource>);
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

  return save(oystehr, claim, before, agent, claimReference, extraRequests);
}

async function createCopy(
  oystehr: Oystehr,
  resourceType: 'Practitioner' | 'Organization' | 'Location',
  resourceId: string
): Promise<FhirResource> {
  const original = await fetchById<Practitioner | Organization | Location>(oystehr, resourceType, resourceId);
  return oystehr.fhir.create(prepareWorkingCopy(original, resourceId));
}

async function save(
  oystehr: Oystehr,
  resource: FhirResource,
  before: FhirResource,
  agent: ProvenanceAgent,
  claimReference: string,
  extraRequests: BatchInputRequest<FhirResource>[] = []
): Promise<{ id: string | undefined }> {
  const provenance = claimProvenanceRequest({
    targetReference: `${resource.resourceType}/${resource.id}`,
    claimReference,
    before,
    after: resource,
    agent,
    activity: 'update',
    recorded: new Date().toISOString(),
    priorVersionReference: versionedReference(before),
  });
  const requests: BatchInputRequest<FhirResource>[] = [
    { method: 'PUT', url: `${resource.resourceType}/${resource.id}`, resource },
    ...(provenance ? [provenance as BatchInputRequest<FhirResource>] : []),
    ...extraRequests,
  ];
  await oystehr.fhir.transaction<FhirResource>({ requests });
  return { id: resource.id };
}

function applyName(resource: Patient | Practitioner, firstName?: string, lastName?: string): void {
  const name: { use: 'official'; given?: string[]; family?: string } = { use: 'official' };
  if (firstName !== undefined) name.given = [firstName];
  if (lastName !== undefined) name.family = lastName;
  if (name.given || name.family) resource.name = [name];
}
