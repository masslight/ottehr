import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Coverage, Location, Organization, Patient, Person, Practitioner, Resource } from 'fhir/r4b';
import {
  ClaimDetailResponse,
  FHIR_RESOURCE_NOT_FOUND,
  getClaimStatusValues,
  getNPI,
  getPayerId,
  getResourcesFromBatchInlineRequests,
  getTaxID,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  CLAIM_TAG_SYSTEM,
  createBillingClient,
  fhirName,
  findRef,
  formatAddress,
  getClaimStatus,
  getClaimType,
  resolvePayersByRef,
  sortClaimInsurance,
  SOURCE_IDENTIFIER_SYSTEM,
  toAddressParts,
} from '../shared';
import { GetClaimDetailParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-claim-detail';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: GetClaimDetailParams): Promise<ClaimDetailResponse> {
  const { claimId } = params;
  const bundle = await oystehr.fhir.search<Claim>({
    resourceType: 'Claim',
    params: [
      { name: '_id', value: claimId },
      { name: '_include', value: 'Claim:patient' },
      { name: '_include', value: 'Claim:provider' },
      { name: '_include', value: 'Claim:facility' },
    ],
  });
  const resources = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];

  const claim = resources.find((r) => r.resourceType === 'Claim' && r.id === claimId) as Claim | undefined;
  if (!claim) throw FHIR_RESOURCE_NOT_FOUND('Claim');

  const patient = findRef<Patient>(resources, claim.patient?.reference);
  const provider = findRef<Practitioner | Organization>(resources, claim.provider?.reference);
  const facility = findRef<Location>(resources, claim.facility?.reference);

  // Batch-fetch coverage, rendering practitioner, and secondary insurance
  const sortedInsurance = sortClaimInsurance(claim);

  const followUpQueries: string[] = [];
  const coverageRef = sortedInsurance[0]?.coverage?.reference;
  if (coverageRef) followUpQueries.push(`/Coverage?_id=${coverageRef.replace('Coverage/', '')}`);
  const renderingRef = claim.careTeam?.[0]?.provider?.reference;
  if (renderingRef?.startsWith('Practitioner/') || renderingRef?.startsWith('Organization/')) {
    const [renderingType, renderingId] = renderingRef.split('/');
    followUpQueries.push(`/${renderingType}?_id=${renderingId}`);
  }
  const secCovRef = sortedInsurance[1]?.coverage?.reference;
  if (secCovRef) {
    followUpQueries.push(`/Coverage?_id=${secCovRef.replace('Coverage/', '')}`);
  }

  const followUp =
    followUpQueries.length > 0 ? await getResourcesFromBatchInlineRequests(oystehr, followUpQueries) : [];

  const coverage = coverageRef
    ? (followUp.find((r) => r.resourceType === 'Coverage' && r.id === coverageRef.replace('Coverage/', '')) as
        | Coverage
        | undefined)
    : undefined;
  const renderingId = renderingRef?.split('/')[1];
  const renderingProvider = renderingId
    ? (followUp.find(
        (r) => r.id === renderingId && (r.resourceType === 'Practitioner' || r.resourceType === 'Organization')
      ) as Practitioner | Organization | undefined)
    : undefined;

  let secondaryCoverage: Coverage | undefined;
  if (secCovRef) {
    const secCovId = secCovRef.replace('Coverage/', '');
    secondaryCoverage = followUp.find((r) => r.resourceType === 'Coverage' && r.id === secCovId) as
      | Coverage
      | undefined;
  }

  // Resolve primary and secondary payers from the Oystehr payer list
  const payersByRef = await resolvePayersByRef(oystehr, [
    claim.insurer?.reference,
    secondaryCoverage?.payor?.[0]?.reference,
  ]);
  const insurer = claim.insurer?.reference ? payersByRef.get(claim.insurer.reference) : undefined;
  const secondaryInsurer = secondaryCoverage?.payor?.[0]?.reference
    ? payersByRef.get(secondaryCoverage.payor[0].reference)
    : undefined;

  // Other claims via Person lookup
  const otherClaims = await fetchOtherClaims(oystehr, patient?.id, claimId);

  const billed = claim.total?.value ?? 0;
  const status = getClaimStatus(claim);
  const patientAddr = patient?.address?.[0];

  return {
    id: claim.id ?? '',
    type: getClaimType(claim),
    status,
    statuses: getClaimStatusValues(claim),
    created: claim.created ?? '',
    billingType: sortedInsurance.length ? 'Insurance Pay' : 'Self Pay',
    billableStatus: claim.status === 'entered-in-error' ? 'Not Billable' : 'Billable',
    patientName: fhirName(patient),
    patientDob: patient?.birthDate ?? '',
    patientGender: patient?.gender ?? '',
    patientId: patient?.id ?? '',
    patientOriginalId:
      patient?.extension
        ?.find((ext) => ext.url === SOURCE_IDENTIFIER_SYSTEM)
        ?.valueReference?.reference?.replace('Patient/', '') ?? '',
    patientAddress: formatAddress(patientAddr),
    patientAddressParts: toAddressParts(patientAddr),
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
    renderingProviderId: renderingProvider?.id ?? '',
    renderingProviderType: renderingProvider?.resourceType ?? '',
    renderingProvider: renderingProvider
      ? renderingProvider.resourceType === 'Practitioner'
        ? fhirName(renderingProvider)
        : renderingProvider.name ?? ''
      : '',
    renderingNpi: renderingProvider ? getNPI(renderingProvider) ?? '' : '',
    billingProviderFhirId: provider?.id ?? '',
    billingProviderType: provider?.resourceType ?? '',
    billingProvider: provider
      ? provider.resourceType === 'Practitioner'
        ? fhirName(provider)
        : provider.name ?? ''
      : '',
    billingNpi: provider ? getNPI(provider) ?? '' : '',
    billingTin: provider ? getTaxID(provider) ?? '' : '',
    facilityFhirId: facility?.id ?? '',
    serviceFacility: facility?.name ?? '',
    serviceFacilityAddress: formatAddress(facility?.address),
    serviceFacilityAddressParts: toAddressParts(facility?.address),
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
    tags: (claim.meta?.tag ?? [])
      .filter((t) => t.system === CLAIM_TAG_SYSTEM)
      .map((t) => t.code ?? '')
      .filter(Boolean),
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
  const otherQuery = `/Claim?patient=${patientParam}&_sort=-created&_count=20`;
  const otherResources = await getResourcesFromBatchInlineRequests(oystehr, [otherQuery]);
  const otherClaims = otherResources.filter((r) => r.resourceType === 'Claim' && r.id !== currentClaimId) as Claim[];

  const payersByRef = await resolvePayersByRef(
    oystehr,
    otherClaims.map((c) => c.insurer?.reference)
  );

  return otherClaims.map((c) => ({
    id: c.id ?? '',
    type: getClaimType(c),
    status: getClaimStatus(c),
    arStage: getClaimStatusValues(c).arStage,
    serviceDate: c.item?.[0]?.servicedPeriod?.start ?? c.created ?? '',
    payerName: (c.insurer?.reference ? payersByRef.get(c.insurer.reference) : undefined)?.name ?? '',
    billed: c.total?.value ?? 0,
    cptCodes: (c.item ?? []).map((item) => item.productOrService?.coding?.[0]?.code ?? '').filter(Boolean),
  }));
}
