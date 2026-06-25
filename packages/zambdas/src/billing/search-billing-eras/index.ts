import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Organization, PaymentReconciliation } from 'fhir/r4b';
import { EraListItem, getPayerId, getPayerUrl } from 'utils';
import { checkOrCreateM2MClientToken, fetchAllPages, wrapHandler, ZambdaInput } from '../../shared';
import {
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  ERA_CHECK_SYSTEM,
  ERA_ID_SYSTEM,
  resolvePayersByRef,
} from '../shared';
import { SearchErasParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-eras';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  params: SearchErasParams
): Promise<{ eras: EraListItem[]; total: number; offset: number; pageSize: number }> {
  const pageSize = params.pageSize ?? 25;
  const offset = params.offset ?? 0;
  const hasClaimFilters = params.claimStatus || params.dosFrom || params.dosTo || params.patientId || params.searchText;

  // Resolve the payer filter to Oystehr payer list URLs
  let payerIssuerFilter: string | undefined;
  if (params.payerId) {
    payerIssuerFilter = getPayerUrl(params.payerId);
  } else if (params.payerName) {
    const result = await oystehr.rcm.listPayers({ name: params.payerName, limit: 50 });
    const payerIds = result.data.map((p) => getPayerId(p)).filter(Boolean) as string[];
    if (payerIds.length === 0) return { eras: [], total: 0, offset, pageSize };
    payerIssuerFilter = payerIds.map((id) => getPayerUrl(id)).join(',');
  }

  // ERA-level FHIR search
  const searchParams: { name: string; value: string }[] = [
    { name: '_sort', value: '-created' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
  ];
  if (params.eraDateFrom) searchParams.push({ name: 'created', value: `ge${params.eraDateFrom}` });
  if (params.eraDateTo) searchParams.push({ name: 'created', value: `le${params.eraDateTo}` });
  if (params.eraStatus) searchParams.push({ name: 'outcome', value: params.eraStatus });
  if (payerIssuerFilter) searchParams.push({ name: 'payment-issuer', value: payerIssuerFilter });
  if (params.checkNumber) searchParams.push({ name: 'identifier', value: `${ERA_CHECK_SYSTEM}|${params.checkNumber}` });
  if (params.eraId) searchParams.push({ name: 'identifier', value: `${ERA_ID_SYSTEM}|${params.eraId}` });

  if (hasClaimFilters) {
    const claimIds = await findMatchingClaimIds(oystehr, params);
    if (claimIds.size === 0) return { eras: [], total: 0, offset, pageSize };

    const eraIds = await findEraIdentifiersForClaims(oystehr, claimIds);
    if (eraIds.size === 0) return { eras: [], total: 0, offset, pageSize };

    searchParams.push({
      name: 'identifier',
      value: [...eraIds].map((v) => `${ERA_ID_SYSTEM}|${v}`).join(','),
    });
  }

  const bundle = await oystehr.fhir.search<PaymentReconciliation>({
    resourceType: 'PaymentReconciliation',
    params: searchParams,
  });
  const payments = bundle.unbundle();
  const payersByRef = await resolvePayersByRef(
    oystehr,
    payments.map((pr) => pr.paymentIssuer?.reference)
  );
  const eras = payments.map((pr) => mapEra(pr, payersByRef));

  return { eras, total: bundle.total ?? 0, offset, pageSize };
}

// For a given set of claim IDs, return the set of ERA business identifiers that reference any of those claims.
// Claim via `request` and carries its ERA's identifier under ERA_ID_SYSTEM.
async function findEraIdentifiersForClaims(oystehr: Oystehr, claimIds: Set<string>): Promise<Set<string>> {
  const eraIds = new Set<string>();
  const ids = [...claimIds];
  const BATCH = 100;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH).map((id) => `Claim/${id}`);
    const bundle = await oystehr.fhir.search<ClaimResponse>({
      resourceType: 'ClaimResponse',
      params: [
        { name: 'request', value: batch.join(',') },
        { name: '_elements', value: 'identifier' },
        { name: '_count', value: '1000' },
      ],
    });
    for (const cr of bundle.unbundle()) {
      const eraId = cr.identifier?.find((id) => id.system === ERA_ID_SYSTEM)?.value;
      if (eraId) eraIds.add(eraId);
    }
  }
  return eraIds;
}

async function findMatchingClaimIds(oystehr: Oystehr, params: SearchErasParams): Promise<Set<string>> {
  const PAGE_SIZE = 200;
  const baseParams: { name: string; value: string }[] = [{ name: '_elements', value: 'id' }];
  if (params.claimStatus)
    baseParams.push({ name: '_tag', value: `${CURRENT_STATUS_TAG_SYSTEM}|${params.claimStatus}` });
  if (params.dosFrom) baseParams.push({ name: 'created', value: `ge${params.dosFrom}` });
  if (params.dosTo) baseParams.push({ name: 'created', value: `le${params.dosTo}` });
  if (params.patientId) baseParams.push({ name: 'patient', value: `Patient/${params.patientId}` });
  if (params.searchText) baseParams.push({ name: 'patient.name', value: params.searchText });

  const ids = new Set<string>();

  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [...baseParams, { name: '_count', value: String(count) }, { name: '_offset', value: String(offset) }],
    });
    const page = bundle.unbundle();
    for (const c of page) {
      if (c.id) ids.add(c.id);
    }
    return bundle;
  }, PAGE_SIZE);

  return ids;
}

function mapEra(pr: PaymentReconciliation, payersByRef: Map<string, Organization>): EraListItem {
  const payerRef = pr.paymentIssuer?.reference;
  const payerOrg = payerRef ? payersByRef.get(payerRef) : undefined;

  const eraId = pr.identifier?.find((id) => id.system === ERA_ID_SYSTEM)?.value ?? '';
  const checkNumber = pr.identifier?.find((id) => id.system === ERA_CHECK_SYSTEM)?.value ?? '';
  const claimCount = pr.detail?.length ?? 0;
  const matchedCount = pr.detail?.filter((d) => d.request?.reference).length ?? 0;

  return {
    id: pr.id ?? '',
    eraId,
    checkNumber,
    payerName: payerOrg?.name ?? pr.paymentIssuer?.display ?? '',
    paymentDate: pr.paymentDate ?? pr.created ?? '',
    paymentAmount: pr.paymentAmount?.value ?? 0,
    status: pr.outcome ?? pr.status ?? '',
    claimCount,
    matchedCount,
    unmatchedCount: claimCount - matchedCount,
  };
}
