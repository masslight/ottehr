import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Coverage, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BillingClaimItem,
  CLAIM_STATUS_TAG_SYSTEMS,
  CLAIM_TAG_SYSTEM,
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
  getAllFhirSearchPages,
  getClaimStatusValues,
  getPayerId,
  getPayerUrl,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { fetchClaimResponsesByClaimIds, fetchPatientPaidByClaimId, summarizeClaimPayments } from '../claim-amounts';
import {
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  determineRulesEngineForClaim,
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

  const filterParams: { name: string; value: string }[] = [
    { name: '_include', value: 'Claim:patient' },
    { name: '_include', value: 'Claim:facility' },
    { name: '_sort', value: '-_lastUpdated' },
  ];

  if (params.type) filterParams.push({ name: '_tag', value: `${CODE_SYSTEM_CLAIM_TYPE}|${params.type}` });
  if (params.status) filterParams.push({ name: '_tag', value: `${CURRENT_STATUS_TAG_SYSTEM}|${params.status}` });
  if (params.arStage)
    filterParams.push({ name: '_tag', value: `${CLAIM_STATUS_TAG_SYSTEMS.arStage}|${params.arStage}` });
  if (params.createdFrom) filterParams.push({ name: 'created', value: `ge${params.createdFrom}` });
  if (params.createdTo) filterParams.push({ name: 'created', value: `le${params.createdTo}` });
  if (params.patientId) filterParams.push({ name: 'patient', value: `Patient/${params.patientId}` });
  if (params.service)
    filterParams.push({ name: '_tag', value: `${CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM}|${params.service}` });
  if (params.searchText) filterParams.push({ name: 'patient.name', value: params.searchText });
  if (insurerFilter) filterParams.push({ name: 'insurer', value: insurerFilter });
  if (params.tag) filterParams.push({ name: '_tag', value: `${CLAIM_TAG_SYSTEM}|${params.tag}` });

  const filteringByServiceDate = Boolean(params.serviceDateFrom || params.serviceDateTo);

  let pageClaims: Claim[];
  let includedResources: Resource[];
  let total: number;

  if (filteringByServiceDate) {
    includedResources = await getAllFhirSearchPages<Claim | Patient | Location | Practitioner>(
      {
        resourceType: 'Claim',
        params: filterParams,
      },
      oystehr
    );
    const matching = includedResources
      .filter((r): r is Claim => r.resourceType === 'Claim')
      .filter((c) => claimMatchesServiceDateRange(c, params.serviceDateFrom, params.serviceDateTo));
    total = matching.length;
    pageClaims = matching.slice(offset, offset + pageSize);
  } else {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        ...filterParams,
        { name: '_count', value: String(pageSize) },
        { name: '_offset', value: String(offset) },
        { name: '_total', value: 'accurate' },
      ],
    });
    total = bundle.total ?? 0;
    includedResources = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean) as Resource[];
    pageClaims = includedResources.filter((r) => r.resourceType === 'Claim') as Claim[];
  }

  const patients = includedResources.filter((r) => r.resourceType === 'Patient') as Patient[];
  const locations = includedResources.filter((r) => r.resourceType === 'Location') as Location[];
  const practitioners = includedResources.filter((r) => r.resourceType === 'Practitioner') as Practitioner[];

  const items = await enrichAndMapClaims(oystehr, pageClaims, {
    patients,
    locations,
    practitioners,
  });

  return {
    claims: items,
    total,
    offset,
    pageSize,
  };
}

export const getClaimServiceDate = (claim: Claim): string =>
  claim.item?.[0]?.servicedPeriod?.start ?? claim.item?.[0]?.servicedDate ?? claim.created ?? '';

const toServiceDay = (value?: string): string | null =>
  value ? DateTime.fromISO(value, { setZone: true }).toISODate() : null;

export const claimMatchesServiceDateRange = (claim: Claim, from?: string, to?: string): boolean => {
  const day = toServiceDay(getClaimServiceDate(claim));
  if (!day) return false;
  const fromDay = toServiceDay(from);
  const toDay = toServiceDay(to);
  if (fromDay && day < fromDay) return false;
  if (toDay && day > toDay) return false;
  return true;
};

async function enrichAndMapClaims(
  oystehr: Oystehr,
  claims: Claim[],
  included: { patients: Patient[]; locations: Location[]; practitioners: Practitioner[] }
): Promise<BillingClaimItem[]> {
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

  const [payersByRef, claimResponsesByClaimId, patientPaidByClaimId] = await Promise.all([
    resolvePayersByRef(
      oystehr,
      claims.map((c) => c.insurer?.reference)
    ),
    fetchClaimResponsesByClaimIds(oystehr, claims.map((c) => c.id).filter(Boolean) as string[]),
    fetchPatientPaidByClaimId({
      oystehr,
      claims,
    }),
  ]);

  const lookups: ClaimLookups = {
    patients: included.patients,
    payersByRef,
    locations: included.locations,
    practitioners: included.practitioners,
    coverages,
    claimResponsesByClaimId,
    patientPaidByClaimId,
  };
  return claims.map((claim) => mapClaimToItem(claim, lookups));
}

interface ClaimLookups {
  patients: Patient[];
  payersByRef: Map<string, Organization>;
  locations: Location[];
  practitioners: Practitioner[];
  coverages: Coverage[];
  claimResponsesByClaimId: Map<string, ClaimResponse[]>;
  patientPaidByClaimId: Map<string, number>;
}

export function mapClaimToItem(claim: Claim, lookups: ClaimLookups): BillingClaimItem {
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

  const serviceDate = getClaimServiceDate(claim);
  const patientPaid = lookups.patientPaidByClaimId.get(claim.id ?? '') ?? 0;
  const payments = summarizeClaimPayments(
    lookups.claimResponsesByClaimId.get(claim.id ?? '') ?? [],
    billed,
    patientPaid
  );

  return {
    id: claim.id ?? '',
    type: getClaimType(claim),
    status: getClaimStatus(claim),
    statuses: getClaimStatusValues(claim),
    rulesEngine: determineRulesEngineForClaim(claim),
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
    adjudicated: payments.adjudicated,
    responsibleParty: 'Primary',
    tags: (claim.meta?.tag ?? [])
      .filter((t) => t.system === CLAIM_TAG_SYSTEM)
      .map((t) => t.code ?? '')
      .filter(Boolean),
  };
}
