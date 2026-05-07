import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, Claim, Coverage, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { convertFhirNameToDisplayName, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, findRef, getClaimStatus, getPayerId } from '../shared';
import { GetBillingClaimsParams, validateRequestParameters } from './validateRequestParameters';

interface BillingClaimItem {
  id: string;
  status: string;
  patientName: string;
  patientDob: string;
  payerName: string;
  payerId: string;
  memberId: string;
  serviceDate: string;
  facility: string;
  renderingProvider: string;
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  claimBalance: number;
  responsibleParty: string;
}

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-claims';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    const response = await fetchClaims(oystehr, params);
    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: unknown) {
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

async function fetchClaims(
  oystehr: Oystehr,
  params: GetBillingClaimsParams
): Promise<{ claims: BillingClaimItem[]; total: number; offset: number; pageSize: number }> {
  const pageSize = params.pageSize ?? 25;
  const offset = params.offset ?? 0;

  const searchParams: { name: string; value: string }[] = [
    { name: '_include', value: 'Claim:patient' },
    { name: '_include', value: 'Claim:insurer' },
    { name: '_include', value: 'Claim:provider' },
    { name: '_include', value: 'Claim:facility' },
    { name: '_sort', value: '-_lastUpdated' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
  ];

  if (params.status) searchParams.push({ name: '_tag', value: params.status });
  if (params.dosFrom) searchParams.push({ name: 'created', value: `ge${params.dosFrom}` });
  if (params.dosTo) searchParams.push({ name: 'created', value: `le${params.dosTo}` });
  if (params.patientId) searchParams.push({ name: 'patient', value: `Patient/${params.patientId}` });
  if (params.payerName) searchParams.push({ name: 'insurer.name', value: params.payerName });
  if (params.payerId) searchParams.push({ name: 'insurer.identifier', value: params.payerId });

  // Use fhir.search directly to access Bundle.total for real pagination
  const bundle = await oystehr.fhir.search<Claim>({ resourceType: 'Claim', params: searchParams });
  const total = (bundle as unknown as Bundle).total ?? 0;

  const resources = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];
  const claims = resources.filter((r) => r.resourceType === 'Claim') as Claim[];
  const patients = resources.filter((r) => r.resourceType === 'Patient') as Patient[];
  const orgs = resources.filter((r) => r.resourceType === 'Organization') as Organization[];
  const locations = resources.filter((r) => r.resourceType === 'Location') as Location[];
  const practitioners = resources.filter((r) => r.resourceType === 'Practitioner') as Practitioner[];

  // Batch-fetch coverages for the current page
  const coverageIds = claims
    .map((c) => {
      const sorted = [...(c.insurance ?? [])].sort((a, b) => a.sequence - b.sequence);
      return sorted[0]?.coverage?.reference?.replace('Coverage/', '');
    })
    .filter(Boolean) as string[];
  const uniqueCoverageIds = [...new Set(coverageIds)];

  let coverages: Coverage[] = [];
  if (uniqueCoverageIds.length > 0) {
    const covResult = await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [{ name: '_id', value: uniqueCoverageIds.join(',') }],
    });
    coverages = covResult.unbundle();
  }

  const lookups = { patients, orgs, locations, practitioners, coverages };
  let items = claims.map((claim) => mapClaimToItem(claim, lookups));

  // In-memory text search on the current page only
  if (params.searchText) {
    const q = params.searchText.toLowerCase();
    items = items.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.patientName.toLowerCase().includes(q) ||
        item.payerName.toLowerCase().includes(q) ||
        item.payerId.toLowerCase().includes(q) ||
        item.memberId.toLowerCase().includes(q) ||
        item.patientDob.includes(q)
    );
  }

  return { claims: items, total, offset, pageSize };
}

interface ClaimLookups {
  patients: Patient[];
  orgs: Organization[];
  locations: Location[];
  practitioners: Practitioner[];
  coverages: Coverage[];
}

function mapClaimToItem(claim: Claim, lookups: ClaimLookups): BillingClaimItem {
  const patient = findRef<Patient>(lookups.patients, claim.patient?.reference);
  const insurer = findRef<Organization>(lookups.orgs, claim.insurer?.reference);
  const facility = findRef<Location>(lookups.locations, claim.facility?.reference);
  const sortedInsurance = [...(claim.insurance ?? [])].sort((a, b) => a.sequence - b.sequence);
  const coverage = findRef<Coverage>(lookups.coverages, sortedInsurance[0]?.coverage?.reference);
  const billed = claim.total?.value ?? 0;

  const practRef = claim.careTeam?.[0]?.provider?.reference;
  const pract = findRef<Practitioner>(lookups.practitioners, practRef);
  const practName = pract?.name?.[0] ? convertFhirNameToDisplayName(pract.name[0]) : '';
  const patientName = patient?.name?.[0] ? convertFhirNameToDisplayName(patient.name[0]) : '';

  const serviceDate = claim.item?.[0]?.servicedPeriod?.start ?? claim.item?.[0]?.servicedDate ?? claim.created ?? '';

  return {
    id: claim.id ?? '',
    status: getClaimStatus(claim),
    patientName,
    patientDob: patient?.birthDate ?? '',
    payerName: insurer?.name ?? '',
    payerId: insurer ? getPayerId(insurer) : '',
    memberId: coverage?.subscriberId ?? '',
    serviceDate,
    facility: facility?.name ?? '',
    renderingProvider: practName,
    billed,
    // TODO: wire payment data from ClaimResponse/PaymentReconciliation
    allowed: 0,
    insurancePaid: 0,
    patientResp: 0,
    patientPaid: 0,
    claimBalance: billed,
    responsibleParty: 'Primary',
  };
}
