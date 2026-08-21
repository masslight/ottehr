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
import { codeableConcept, setNpi } from 'utils/lib/fhir/helpers';
import { getPayerUrl } from 'utils/lib/helpers/helpers';
import {
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
  CODE_SYSTEM_HL7_HCPCS,
  CODE_SYSTEM_ICD_10,
  CODE_SYSTEM_OYSTEHR_CLAIM_PROCEDURE_MODIFIER,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
} from 'utils/lib/helpers/rcm/constants';
import { BillingPolicyHolderInput, BillingSubscriberRelationship } from 'utils/lib/types/data/billing/billing.schemas';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { updateExtension } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { commitClaimResourceChange, diffResources, resolveClaimActor } from '../provenance';
import {
  attachCoverageToClaim,
  buildAddress,
  buildClaimCoverageCopies,
  buildDiagnosisSequence,
  buildSubscriberRelatedPerson,
  claimHasRealCoverage,
  CODE_SYSTEM_NUBC_REVENUE,
  createBillingClient,
  ensureClaimInsurance,
  EXTENSION_CLAIM_ADMISSION_TYPE_CODE,
  EXTENSION_CLAIM_FACILITY_TYPE_CODE,
  EXTENSION_CLAIM_FREQUENCY_CODE,
  EXTENSION_CLAIM_PATIENT_DISCHARGE_STATUS,
  EXTENSION_CLAIM_POINT_OF_ORIGIN_CODE,
  fetchById,
  getClaimTypeCoding,
  payerDisplay,
  prepareWorkingCopy,
  resolvePayersByRef,
  resourceDisplayName,
  setClaimRenderingProviderCareTeam,
  setClia,
  setCoverageRelationship,
  setTaxId,
  setTaxonomy,
} from '../shared';
import { UpdateBillingClaimParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

// Only fields present in the request are touched. Each branch snapshots the resource before mutating
// so the change can be recorded as a Provenance written in the same transaction as the update.
export async function performEffect(
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
      return commitClaimResourceChange(oystehr, { resource: patient, before, agent, claimReference });
    }
    case 'Practitioner': {
      const practitioner = await fetchById<Practitioner>(oystehr, 'Practitioner', params.resourceId);
      const before = structuredClone(practitioner);
      const { fields } = params;
      applyName(practitioner, fields.firstName, fields.lastName);
      if (fields.npi !== undefined) setNpi(practitioner, fields.npi);
      if (fields.taxId !== undefined) setTaxId(practitioner, fields.taxId);
      if (fields.taxonomyCode !== undefined) setTaxonomy(practitioner, fields.taxonomyCode);
      return commitClaimResourceChange(oystehr, { resource: practitioner, before, agent, claimReference });
    }
    case 'Coverage': {
      const coverage = await fetchById<Coverage>(oystehr, 'Coverage', params.resourceId);
      const before = structuredClone(coverage);
      const { fields } = params;
      if (fields.subscriberId !== undefined) coverage.subscriberId = fields.subscriberId;
      if (fields.relationship === undefined) {
        return commitClaimResourceChange(oystehr, { resource: coverage, before, agent, claimReference });
      }
      return saveCoverageSubscriber({
        oystehr,
        coverage,
        relationship: fields.relationship,
        policyHolder: fields.policyHolder,
        before,
        agent,
        claimReference,
      });
    }
    case 'Location': {
      const facility = await fetchById<Location>(oystehr, 'Location', params.resourceId);
      const before = structuredClone(facility);
      const { fields } = params;
      if (fields.name !== undefined) facility.name = fields.name;
      if (fields.npi !== undefined) setNpi(facility, fields.npi);
      if (fields.clia !== undefined) setClia(facility, fields.clia);
      if (fields.address !== undefined) facility.address = buildAddress(fields.address);
      return commitClaimResourceChange(oystehr, { resource: facility, before, agent, claimReference });
    }
    case 'Organization': {
      const organization = await fetchById<Organization>(oystehr, 'Organization', params.resourceId);
      const before = structuredClone(organization);
      const { fields } = params;
      if (fields.name !== undefined) organization.name = fields.name;
      if (fields.npi !== undefined) setNpi(organization, fields.npi);
      if (fields.taxId !== undefined) setTaxId(organization, fields.taxId);
      if (fields.taxonomyCode !== undefined) setTaxonomy(organization, fields.taxonomyCode);
      return commitClaimResourceChange(oystehr, { resource: organization, before, agent, claimReference });
    }
  }
}

// Mirror update-billing-coverage: relationship/policy-holder edits also create/update/delete the
// working-copy subscriber RelatedPerson, so the coverage and the person are written in one transaction.
// Policy-holder edits are recorded as `policyHolder.*` change entries on the Coverage's Provenance.
async function saveCoverageSubscriber(input: {
  oystehr: Oystehr;
  coverage: Coverage;
  relationship: BillingSubscriberRelationship;
  policyHolder?: BillingPolicyHolderInput;
  before: Coverage;
  agent: ProvenanceAgent;
  claimReference: string;
}): Promise<{ id: string | undefined }> {
  const { oystehr, coverage, relationship, policyHolder, before, agent, claimReference } = input;
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

  return commitClaimResourceChange(oystehr, {
    resource: coverage,
    before,
    agent,
    claimReference,
    extraChanges: policyHolderChanges,
    preRequests: pre,
    postRequests: post,
  });
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
    claim.type = { coding: [getClaimTypeCoding(fields.type)] };
    const tags = [
      ...(claim.meta?.tag ?? []).filter((t) => t.system !== CODE_SYSTEM_CLAIM_TYPE),
      getClaimTypeCoding(fields.type),
    ];
    claim.meta ??= {};
    claim.meta.tag = tags;
  }

  if (fields.service) {
    claim.meta ??= {};
    claim.meta.tag = [
      ...(claim.meta.tag ?? []).filter((t) => t.system !== CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM),
      { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: fields.service },
    ];
  }

  if (fields.billingProvider) {
    const copy = await createCopy(oystehr, fields.billingProvider.type, fields.billingProvider.id);
    claim.provider = { reference: `${fields.billingProvider.type}/${copy.id}`, display: resourceDisplayName(copy) };
  }

  if (fields.renderingProvider) {
    const copy = await createCopy(oystehr, fields.renderingProvider.type, fields.renderingProvider.id);
    setClaimRenderingProviderCareTeam(claim, {
      reference: `${fields.renderingProvider.type}/${copy.id}`,
      display: resourceDisplayName(copy),
    });
  }

  if (fields.facilityId) {
    const copy = await createCopy(oystehr, 'Location', fields.facilityId);
    claim.facility = { reference: `Location/${copy.id}`, display: resourceDisplayName(copy) };
  }

  if (fields.coverageId) {
    const original = await fetchById<Coverage>(oystehr, 'Coverage', fields.coverageId);
    // Mirror the encounter path: copy the subscriber RelatedPerson so the policy holder is preserved.
    const subscriberRef = original.subscriber?.reference;
    const subscriber = subscriberRef?.startsWith('RelatedPerson/')
      ? await fetchById<RelatedPerson>(oystehr, 'RelatedPerson', subscriberRef.replace('RelatedPerson/', ''))
      : undefined;
    const { coverage: copy, subscriber: subscriberCopy } = buildClaimCoverageCopies({
      coverage: original,
      subscriber,
      patientReference: claim.patient?.reference,
    });
    if (subscriberCopy) {
      const createdSubscriber = await oystehr.fhir.create(subscriberCopy);
      copy.subscriber = { reference: `RelatedPerson/${createdSubscriber.id}` };
    }
    const created = await oystehr.fhir.create(copy);
    const payerRef = created.payor?.[0]?.reference;
    const display = payerRef ? payerDisplay((await resolvePayersByRef(oystehr, [payerRef])).get(payerRef)) : undefined;
    attachCoverageToClaim({
      claim,
      coverageReference: `Coverage/${created.id}`,
      type: fields.coverageType ?? 'primary',
      display,
      payerReference: payerRef,
    });
  }

  if (fields.removeCoverage) {
    let newInsurance = claim.insurance.filter(
      (ins) => ins.coverage.reference?.replace('Coverage/', '') !== fields.removeCoverage
    );
    if (!newInsurance.length) {
      // Make the claim self-pay; ensureClaimInsurance restores the no-coverage stub below.
      claim.insurance = [];
      delete claim.insurer;
    } else {
      newInsurance = newInsurance.map((ins, ind) => {
        ins.sequence = ind + 1;
        return ins;
      });
      if (!newInsurance.some((ins) => ins.focal)) {
        newInsurance[0].focal = true;
      }
      claim.insurance = newInsurance;
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
      productOrService: { coding: [{ system: CODE_SYSTEM_HL7_HCPCS, code: line.cptCode }] },
      modifier: line.modifiers?.length
        ? line.modifiers.map((m) => ({
            coding: [{ system: CODE_SYSTEM_OYSTEHR_CLAIM_PROCEDURE_MODIFIER, code: m }],
          }))
        : undefined,
      servicedPeriod: { start: line.serviceDate },
      locationCodeableConcept: line.placeOfService
        ? { coding: [{ system: CODE_SYSTEM_CMS_PLACE_OF_SERVICE, code: line.placeOfService }] }
        : undefined,
      net: { value: line.charges, currency: 'USD' },
      quantity: { value: line.units, unit: 'UN' },
      revenue: line.revenueCode ? codeableConcept(line.revenueCode, CODE_SYSTEM_NUBC_REVENUE) : undefined,
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

  if (fields.serviceDate) {
    // Claim-level DOS edit: apply the one date to every line (matches Create Claim's one-DOS-per-claim model).
    claim.item = claim.item?.map((item) => ({
      ...item,
      servicedPeriod: { ...item.servicedPeriod, start: fields.serviceDate },
    }));
  }

  // Guarantee the Claim.insurance invariant regardless of which fields changed: keep the no-coverage
  // stub when there's no real coverage, and re-add it if a coverage was ever removed.
  claim.insurance = ensureClaimInsurance(claim.insurance);

  if (fields.payerId || fields.planType) {
    const payerUrl = fields.payerId ? getPayerUrl(fields.payerId) : undefined;
    const display = fields.payerId ? payerDisplay(await oystehr.rcm.getPayer({ id: fields.payerId })) : undefined;
    // A payer is only meaningful with a real coverage; a stub-only claim stays uninsured.
    if (payerUrl && claimHasRealCoverage(claim.insurance)) claim.insurer = { reference: payerUrl, display };
  }

  if (fields.billType) {
    updateExtension(claim, {
      url: EXTENSION_CLAIM_FACILITY_TYPE_CODE,
      valueString: fields.billType.substring(1, 3),
    });
    updateExtension(claim, {
      url: EXTENSION_CLAIM_FREQUENCY_CODE,
      valueString: fields.billType.substring(3, 4),
    });
  }

  if (fields.admissionType) {
    updateExtension(claim, {
      url: EXTENSION_CLAIM_ADMISSION_TYPE_CODE,
      valueString: fields.admissionType,
    });
  }

  if (fields.admissionSource) {
    updateExtension(claim, {
      url: EXTENSION_CLAIM_POINT_OF_ORIGIN_CODE,
      valueString: fields.admissionSource,
    });
  }

  if (fields.patientDischargeStatusCode) {
    updateExtension(claim, {
      url: EXTENSION_CLAIM_PATIENT_DISCHARGE_STATUS,
      valueString: fields.patientDischargeStatusCode,
    });
  }

  return commitClaimResourceChange(oystehr, {
    resource: claim,
    before,
    agent,
    claimReference,
    postRequests: extraRequests,
  });
}

async function createCopy(
  oystehr: Oystehr,
  resourceType: 'Practitioner' | 'Organization' | 'Location',
  resourceId: string
): Promise<FhirResource> {
  const original = await fetchById<Practitioner | Organization | Location>(oystehr, resourceType, resourceId);
  return oystehr.fhir.create(prepareWorkingCopy(original, resourceId));
}

function applyName(resource: Patient | Practitioner, firstName?: string, lastName?: string): void {
  const name: { use: 'official'; given?: string[]; family?: string } = { use: 'official' };
  if (firstName !== undefined) name.given = [firstName];
  if (lastName !== undefined) name.family = lastName;
  if (name.given || name.family) resource.name = [name];
}
