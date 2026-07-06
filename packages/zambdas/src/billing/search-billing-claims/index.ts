import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Coverage, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import {
  BillingClaimItem,
  CLAIM_STATUS_TAG_SYSTEMS,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
  getClaimStatusValues,
  getPayerId,
  getPayerUrl,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { fetchClaimResponsesByClaimIds, summarizeClaimPayments } from '../claim-amounts';
import {
  CLAIM_TAG_SYSTEM,
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  fhirName,
  findRef,
  getClaimService,
  getClaimStatus,
  getClaimType,
  resolvePayersByRef,
  sortClaimInsurance,
} from '../shared';
import { SearchBillingClaimsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-claims';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingClaimsParams
): Promise<{ claims: BillingClaimItem[]; total: number; offset: number; pageSize: number }> {
  const pageSize = params.pageSize ?? 25;
  const offset = params.offset ?? 0;

  // Resolve the payer filter to Oystehr payer list URLs
  let insurerFilter: string | undefined;
  if (params.payerId) {
    insurerFilter = getPayerUrl(params.payerId);
  } else if (params.payerName) {
    const result = await oystehr.rcm.listPayers({ name: params.payerName, limit: 50 });
    const payerIds = result.data.map((p) => getPayerId(p)).filter(Boolean) as string[];
    if (payerIds.length === 0) return { claims: [], total: 0, offset, pageSize };
    insurerFilter = payerIds.map((id) => getPayerUrl(id)).join(',');
  }

  const searchParams: { name: string; value: string }[] = [
    { name: '_include', value: 'Claim:patient' },
    { name: '_include', value: 'Claim:facility' },
    { name: '_sort', value: '-_lastUpdated' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
    { name: '_total', value: 'exact' },
  ];

  if (params.type) searchParams.push({ name: '_tag', value: `${CODE_SYSTEM_CLAIM_TYPE}|${params.type}` });
  if (params.status) searchParams.push({ name: '_tag', value: `${CURRENT_STATUS_TAG_SYSTEM}|${params.status}` });
  if (params.arStage)
    searchParams.push({ name: '_tag', value: `${CLAIM_STATUS_TAG_SYSTEMS.arStage}|${params.arStage}` });
  if (params.createdFrom) searchParams.push({ name: 'created', value: `ge${params.createdFrom}` });
  if (params.createdTo) searchParams.push({ name: 'created', value: `le${params.createdTo}` });
  if (params.patientId) searchParams.push({ name: 'patient', value: `Patient/${params.patientId}` });
  if (params.service)
    searchParams.push({ name: '_tag', value: `${CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM}|${params.service}` });
  if (params.searchText) searchParams.push({ name: 'patient.name', value: params.searchText });
  if (insurerFilter) searchParams.push({ name: 'insurer', value: insurerFilter });
  if (params.tag) searchParams.push({ name: '_tag', value: `${CLAIM_TAG_SYSTEM}|${params.tag}` });

  // Use fhir.search directly to access Bundle.total for real pagination
  const bundle = await oystehr.fhir.search<Claim>({ resourceType: 'Claim', params: searchParams });
  const total = bundle.total ?? 0;

  const resources = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];
  const claims = resources.filter((r) => r.resourceType === 'Claim') as Claim[];
  const patients = resources.filter((r) => r.resourceType === 'Patient') as Patient[];
  const locations = resources.filter((r) => r.resourceType === 'Location') as Location[];
  const practitioners = resources.filter((r) => r.resourceType === 'Practitioner') as Practitioner[];

  // Batch-fetch coverages for the current page
  const coverageIds = claims
    .map((c) => sortClaimInsurance(c)[0]?.coverage?.reference?.replace('Coverage/', ''))
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

  const [payersByRef, claimResponsesByClaimId] = await Promise.all([
    resolvePayersByRef(
      oystehr,
      claims.map((c) => c.insurer?.reference)
    ),
    fetchClaimResponsesByClaimIds(oystehr, claims.map((c) => c.id).filter(Boolean) as string[]),
  ]);

  const lookups = {
    patients,
    payersByRef,
    locations,
    practitioners,
    coverages,
    claimResponsesByClaimId,
  };
  const items = claims.map((claim) => mapClaimToItem(claim, lookups));

  return { claims: items, total, offset, pageSize };
}

interface ClaimLookups {
  patients: Patient[];
  payersByRef: Map<string, Organization>;
  locations: Location[];
  practitioners: Practitioner[];
  coverages: Coverage[];
  claimResponsesByClaimId: Map<string, ClaimResponse[]>;
}

function mapClaimToItem(claim: Claim, lookups: ClaimLookups): BillingClaimItem {
  const patient = findRef<Patient>(lookups.patients, claim.patient?.reference);
  const insurer = claim.insurer?.reference ? lookups.payersByRef.get(claim.insurer.reference) : undefined;
  const facility = findRef<Location>(lookups.locations, claim.facility?.reference);
  const sortedInsurance = sortClaimInsurance(claim);
  const coverage = findRef<Coverage>(lookups.coverages, sortedInsurance[0]?.coverage?.reference);
  const billed = claim.total?.value ?? 0;

  const practRef = claim.careTeam?.[0]?.provider?.reference;
  const pract = findRef<Practitioner>(lookups.practitioners, practRef);
  const practName = fhirName(pract);
  const patientName = fhirName(patient);

  const serviceDate = claim.item?.[0]?.servicedPeriod?.start ?? claim.item?.[0]?.servicedDate ?? claim.created ?? '';
  const payments = summarizeClaimPayments(lookups.claimResponsesByClaimId.get(claim.id ?? '') ?? [], billed);

  return {
    id: claim.id ?? '',
    type: getClaimType(claim),
    status: getClaimStatus(claim),
    statuses: getClaimStatusValues(claim),
    patientName,
    patientDob: patient?.birthDate ?? '',
    payerName: insurer?.name ?? '',
    payerId: getPayerId(insurer) ?? '',
    memberId: coverage?.subscriberId ?? '',
    service: getClaimService(claim),
    serviceDate,
    facility: facility?.name ?? '',
    renderingProvider: practName,
    billed,
    allowed: payments.allowed,
    insurancePaid: payments.insurancePaid,
    patientResp: payments.patientResp,
    patientPaid: payments.patientPaid,
    claimBalance: payments.balance,
    responsibleParty: 'Primary',
    tags: (claim.meta?.tag ?? [])
      .filter((t) => t.system === CLAIM_TAG_SYSTEM)
      .map((t) => t.code ?? '')
      .filter(Boolean),
  };
}
