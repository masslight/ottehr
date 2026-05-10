import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Coverage, Location, Organization, Patient, Person, Practitioner } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getNPI,
  getPayerId,
  getResourcesFromBatchInlineRequests,
  getSecret,
  getTaxID,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, fhirName, findRef, formatAddress, getClaimStatus, sortClaimInsurance } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-claim-detail';

export interface ClaimDetailResponse {
  id: string;
  status: string;
  created: string;
  billingType: string;
  billableStatus: string;
  patientName: string;
  patientDob: string;
  patientGender: string;
  patientId: string;
  patientAddress: string;
  coverageFhirId: string;
  payorFhirId: string;
  payerName: string;
  payerId: string;
  memberId: string;
  subscriberId: string;
  coverageStatus: string;
  responsibleParty: string;
  secondaryCoverageFhirId: string;
  secondaryPayerName: string;
  secondaryPayerId: string;
  secondaryMemberId: string;
  nonInsurancePayerFhirId: string;
  nonInsurancePayerName: string;
  renderingProviderId: string;
  renderingProvider: string;
  renderingNpi: string;
  billingProviderFhirId: string;
  billingProvider: string;
  billingNpi: string;
  billingTin: string;
  facilityFhirId: string;
  serviceFacility: string;
  serviceFacilityAddress: string;
  serviceFacilityNpi: string;
  diagnoses: { sequence: number; code: string; display: string }[];
  serviceLines: {
    sequence: number;
    cptCode: string;
    description: string;
    modifiers: string[];
    units: number;
    charges: number;
    serviceDate: string;
    placeOfService: string;
    diagnosisPointers: number[];
  }[];
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  balance: number;
  otherClaims: {
    id: string;
    status: string;
    serviceDate: string;
    payerName: string;
    billed: number;
    cptCodes: string[];
  }[];
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const detail = await fetchClaimDetail(oystehr, params.claimId);
    return { statusCode: 200, body: JSON.stringify(detail) };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

async function fetchClaimDetail(oystehr: Oystehr, claimId: string): Promise<ClaimDetailResponse> {
  const query = `/Claim?_id=${claimId}&_include=Claim:patient&_include=Claim:insurer&_include=Claim:provider&_include=Claim:facility`;
  const resources = await getResourcesFromBatchInlineRequests(oystehr, [query]);

  const claim = resources.find((r) => r.resourceType === 'Claim' && r.id === claimId) as Claim | undefined;
  if (!claim) throw FHIR_RESOURCE_NOT_FOUND('Claim');

  const patient = findRef<Patient>(resources, claim.patient?.reference);
  const insurer = findRef<Organization>(resources, claim.insurer?.reference);
  const provider = findRef<Organization>(resources, claim.provider?.reference);
  const facility = findRef<Location>(resources, claim.facility?.reference);

  // Batch-fetch coverage, rendering practitioner, and secondary insurance
  const sortedInsurance = sortClaimInsurance(claim);

  const followUpQueries: string[] = [];
  const coverageRef = sortedInsurance[0]?.coverage?.reference;
  if (coverageRef) followUpQueries.push(`/Coverage?_id=${coverageRef.replace('Coverage/', '')}`);
  const renderingRef = claim.careTeam?.[0]?.provider?.reference;
  if (renderingRef?.startsWith('Practitioner/')) {
    followUpQueries.push(`/Practitioner?_id=${renderingRef.replace('Practitioner/', '')}`);
  }
  const secCovRef = sortedInsurance[1]?.coverage?.reference;
  if (secCovRef) {
    followUpQueries.push(`/Coverage?_id=${secCovRef.replace('Coverage/', '')}&_include=Coverage:payor`);
  }

  const followUp =
    followUpQueries.length > 0 ? await getResourcesFromBatchInlineRequests(oystehr, followUpQueries) : [];

  const coverage = coverageRef
    ? (followUp.find((r) => r.resourceType === 'Coverage' && r.id === coverageRef.replace('Coverage/', '')) as
        | Coverage
        | undefined)
    : undefined;
  const renderingPractitioner = renderingRef
    ? (followUp.find((r) => r.resourceType === 'Practitioner') as Practitioner | undefined)
    : undefined;

  let secondaryCoverage: Coverage | undefined;
  let secondaryInsurer: Organization | undefined;
  if (secCovRef) {
    const secCovId = secCovRef.replace('Coverage/', '');
    secondaryCoverage = followUp.find((r) => r.resourceType === 'Coverage' && r.id === secCovId) as
      | Coverage
      | undefined;
    if (secondaryCoverage?.payor?.[0]?.reference) {
      const payorId = secondaryCoverage.payor[0].reference.replace('Organization/', '');
      secondaryInsurer = followUp.find((r) => r.resourceType === 'Organization' && r.id === payorId) as
        | Organization
        | undefined;
    }
  }

  // Other claims via Person lookup
  const otherClaims = await fetchOtherClaims(oystehr, patient?.id, claimId);

  const billed = claim.total?.value ?? 0;
  const status = getClaimStatus(claim);

  return {
    id: claim.id ?? '',
    status,
    created: claim.created ?? '',
    billingType: sortedInsurance.length ? 'Insurance Pay' : 'Self Pay',
    billableStatus: claim.status === 'entered-in-error' ? 'Not Billable' : 'Billable',
    patientName: fhirName(patient),
    patientDob: patient?.birthDate ?? '',
    patientGender: patient?.gender ?? '',
    patientId: patient?.id ?? '',
    patientAddress: formatAddress(patient?.address?.[0]),
    coverageFhirId: coverage?.id ?? '',
    payorFhirId: insurer?.id ?? '',
    payerName: insurer?.name ?? '',
    payerId: getPayerId(insurer) ?? '',
    memberId: coverage?.subscriberId ?? '',
    subscriberId: coverage?.subscriberId ?? '',
    coverageStatus: coverage?.status ?? '',
    responsibleParty: 'Primary',
    secondaryCoverageFhirId: secondaryCoverage?.id ?? '',
    secondaryPayerName: secondaryInsurer?.name ?? '',
    secondaryPayerId: getPayerId(secondaryInsurer) ?? '',
    secondaryMemberId: secondaryCoverage?.subscriberId ?? '',
    nonInsurancePayerFhirId: '',
    nonInsurancePayerName: '',
    renderingProviderId: renderingPractitioner?.id ?? '',
    renderingProvider: fhirName(renderingPractitioner),
    renderingNpi: renderingPractitioner ? getNPI(renderingPractitioner) ?? '' : '',
    billingProviderFhirId: provider?.id ?? '',
    billingProvider: provider?.name ?? '',
    billingNpi: provider ? getNPI(provider) ?? '' : '',
    billingTin: provider ? getTaxID(provider) ?? '' : '',
    facilityFhirId: facility?.id ?? '',
    serviceFacility: facility?.name ?? '',
    serviceFacilityAddress: formatAddress(facility?.address),
    serviceFacilityNpi: facility ? getNPI(facility) ?? '' : '',
    diagnoses: (claim.diagnosis ?? []).map((dx) => ({
      sequence: dx.sequence,
      code: dx.diagnosisCodeableConcept?.coding?.[0]?.code ?? '',
      display:
        dx.diagnosisCodeableConcept?.coding?.[0]?.display ?? dx.diagnosisCodeableConcept?.coding?.[0]?.code ?? '',
    })),
    serviceLines: (claim.item ?? []).map((item) => ({
      sequence: item.sequence,
      cptCode: item.productOrService?.coding?.[0]?.code ?? '',
      description: item.productOrService?.coding?.[0]?.display ?? '',
      modifiers: (item.modifier ?? []).map((m) => m.coding?.[0]?.code ?? '').filter(Boolean),
      units: item.quantity?.value ?? 1,
      charges: item.net?.value ?? 0,
      serviceDate: item.servicedPeriod?.start ?? item.servicedDate ?? claim.created ?? '',
      placeOfService: item.locationCodeableConcept?.coding?.[0]?.code ?? '',
      diagnosisPointers: item.diagnosisSequence ?? [],
    })),
    billed,
    // TODO: wire payment data from ClaimResponse/PaymentReconciliation
    allowed: 0,
    insurancePaid: 0,
    patientResp: 0,
    patientPaid: 0,
    balance: billed,
    otherClaims,
  };
}

async function fetchOtherClaims(
  oystehr: Oystehr,
  patientId: string | undefined,
  currentClaimId: string
): Promise<ClaimDetailResponse['otherClaims']> {
  if (!patientId) return [];

  let patientIds = [patientId];
  const personResult = await oystehr.fhir.search<Person>({
    resourceType: 'Person',
    params: [{ name: 'link', value: `Patient/${patientId}` }],
  });
  const person = personResult.unbundle()[0];
  if (person?.link) {
    const linkedIds = person.link
      .map((l) => l.target?.reference)
      .filter((ref): ref is string => !!ref && ref.startsWith('Patient/'))
      .map((ref) => ref.replace('Patient/', ''));
    patientIds = [...new Set([...patientIds, ...linkedIds])];
  }

  const patientParam = patientIds.map((pid) => `Patient/${pid}`).join(',');
  const otherQuery = `/Claim?patient=${patientParam}&_include=Claim:insurer&_sort=-created&_count=20`;
  const otherResources = await getResourcesFromBatchInlineRequests(oystehr, [otherQuery]);
  const otherClaims = otherResources.filter((r) => r.resourceType === 'Claim' && r.id !== currentClaimId) as Claim[];
  const otherOrgs = otherResources.filter((r) => r.resourceType === 'Organization') as Organization[];

  return otherClaims.map((c) => ({
    id: c.id ?? '',
    status: getClaimStatus(c),
    serviceDate: c.item?.[0]?.servicedPeriod?.start ?? c.created ?? '',
    payerName: findRef<Organization>(otherOrgs, c.insurer?.reference)?.name ?? '',
    billed: c.total?.value ?? 0,
    cptCodes: (c.item ?? []).map((item) => item.productOrService?.coding?.[0]?.code ?? '').filter(Boolean),
  }));
}
