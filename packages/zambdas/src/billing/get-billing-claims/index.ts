import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Coverage, Location, Organization, Patient, Practitioner } from 'fhir/r4b';
import { convertFhirNameToDisplayName, getResourcesFromBatchInlineRequests, getSecret, SecretsKeys } from 'utils';
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

  let query = `/Claim?_include=Claim:patient&_include=Claim:insurer&_include=Claim:provider&_include=Claim:facility`;
  query += `&_sort=-_lastUpdated&_count=${pageSize}&_offset=${offset}`;
  if (params.status) query += `&_tag=${params.status}`;
  if (params.dosFrom) query += `&created=ge${params.dosFrom}`;
  if (params.dosTo) query += `&created=le${params.dosTo}`;
  if (params.patientId) query += `&patient=Patient/${params.patientId}`;
  if (params.payerName) query += `&insurer.name=${encodeURIComponent(params.payerName)}`;
  if (params.payerId) query += `&insurer.identifier=${encodeURIComponent(params.payerId)}`;

  const resources = await getResourcesFromBatchInlineRequests(oystehr, [query]);

  const claims = resources.filter((r) => r.resourceType === 'Claim') as Claim[];
  const patients = resources.filter((r) => r.resourceType === 'Patient') as Patient[];
  const orgs = resources.filter((r) => r.resourceType === 'Organization') as Organization[];
  const locations = resources.filter((r) => r.resourceType === 'Location') as Location[];
  const practitioners = resources.filter((r) => r.resourceType === 'Practitioner') as Practitioner[];

  // Note: large coverage ID lists may hit URI length limits; chunking deferred until pageSize grows
  const coverageIds = claims
    .map((c) => {
      const sorted = [...(c.insurance ?? [])].sort((a, b) => a.sequence - b.sequence);
      return sorted[0]?.coverage?.reference?.replace('Coverage/', '');
    })
    .filter(Boolean) as string[];
  const uniqueCoverageIds = [...new Set(coverageIds)];

  let coverages: Coverage[] = [];
  if (uniqueCoverageIds.length > 0) {
    const covResources = await getResourcesFromBatchInlineRequests(oystehr, [
      `/Coverage?_id=${uniqueCoverageIds.join(',')}`,
    ]);
    coverages = covResources.filter((r) => r.resourceType === 'Coverage') as Coverage[];
  }

  const lookups = { patients, orgs, locations, practitioners, coverages };
  let items = claims.map((claim) => mapClaimToItem(claim, lookups));

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

  return { claims: items, total: items.length, offset, pageSize };
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
  const status = getClaimStatus(claim);

  return {
    id: claim.id ?? '',
    status,
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
