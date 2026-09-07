import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Organization, PaymentReconciliation } from 'fhir/r4b';
import { getPayerId, getPayerUrl } from 'utils/lib/helpers/helpers';
import { EraListItem } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { countEraClaims, fetchClaimEraLinks, fetchClaimResponsesByPaymentReconciliations } from '../claim-amounts';
import {
  CLAIM_PCN_IDENTIFIER_SYSTEM,
  createBillingClient,
  createEraReadClient,
  CURRENT_STATUS_TAG_SYSTEM,
  eraCheckNumberMatches,
  getEraCheckNumber,
  resolvePayersByRef,
} from '../shared';
import { SearchErasParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-eras';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const eraReadClient = createEraReadClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, eraReadClient, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
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

  // ERA-level FHIR search, without the paging the server can only apply to the filters it runs
  const filterParams: SearchParam[] = [];
  if (params.eraDateFrom) filterParams.push({ name: 'created', value: `ge${params.eraDateFrom}` });
  if (params.eraDateTo) filterParams.push({ name: 'created', value: `le${params.eraDateTo}` });
  if (params.eraStatus) filterParams.push({ name: 'outcome', value: params.eraStatus });
  if (payerIssuerFilter) filterParams.push({ name: 'payment-issuer', value: payerIssuerFilter });

  if (hasClaimFilters) {
    const claimIds = await findMatchingClaimIds(oystehr, params);
    if (claimIds.size === 0) return { eras: [], total: 0, offset, pageSize };

    const prIds = await findEraPaymentReconciliationIds(eraReadClient, claimIds);
    if (prIds.size === 0) return { eras: [], total: 0, offset, pageSize };

    filterParams.push({
      name: '_id',
      value: [...prIds].join(','),
    });
  }

  if (params.matchingStatus === 'anyUnmatched') {
    filterParams.push({
      name: '_has:Provenance:target:target:ClaimResponse.request',
      value: '#claim',
    });
  }

  const { payments, total } = params.checkNumber
    ? await findErasByCheckNumber(eraReadClient, filterParams, params.checkNumber, offset, pageSize)
    : await fetchErasPage(eraReadClient, filterParams, offset, pageSize);

  const claimResponsesByPrId = await fetchClaimResponsesByPaymentReconciliations(eraReadClient, payments);
  // process-era PaymentReconciliations carry no paymentIssuer; resolve the ClaimResponses' payers
  // as the fallback
  const payersByRef = await resolvePayersByRef(oystehr, [
    ...payments.map((pr) => pr.paymentIssuer?.reference),
    ...[...claimResponsesByPrId.values()].flat().map((cr) => cr.insurer?.reference),
  ]);
  const eras = payments.map((pr) => mapEra(pr, payersByRef, claimResponsesByPrId));

  return { eras, total, offset, pageSize };
}

const ERA_SORT_PARAM = {
  name: '_sort',
  value: '-created',
};

const SCAN_PAGE_SIZE = 200;

async function fetchErasPage(
  eraReadClient: Oystehr,
  filterParams: SearchParam[],
  offset: number,
  pageSize: number
): Promise<{
  payments: PaymentReconciliation[];
  total: number;
}> {
  const bundle = await eraReadClient.fhir.search<PaymentReconciliation>({
    resourceType: 'PaymentReconciliation',
    params: [
      ERA_SORT_PARAM,
      ...filterParams,
      {
        name: '_count',
        value: String(pageSize),
      },
      {
        name: '_offset',
        value: String(offset),
      },
    ],
  });
  return {
    payments: bundle.unbundle(),
    total: bundle.total ?? 0,
  };
}

async function findErasByCheckNumber(
  eraReadClient: Oystehr,
  filterParams: SearchParam[],
  checkNumber: string,
  offset: number,
  pageSize: number
): Promise<{
  payments: PaymentReconciliation[];
  total: number;
}> {
  const matchingIds: string[] = [];

  await fetchAllPages(async (scanOffset, count) => {
    const bundle = await eraReadClient.fhir.search<PaymentReconciliation>({
      resourceType: 'PaymentReconciliation',
      params: [
        ERA_SORT_PARAM,
        ...filterParams,
        {
          name: '_elements',
          value: 'id,identifier,paymentIdentifier',
        },
        {
          name: '_count',
          value: String(count),
        },
        {
          name: '_offset',
          value: String(scanOffset),
        },
      ],
    });
    for (const pr of bundle.unbundle()) {
      if (pr.id && eraCheckNumberMatches(pr, checkNumber)) matchingIds.push(pr.id);
    }
    return bundle;
  }, SCAN_PAGE_SIZE);

  const pageIds = matchingIds.slice(offset, offset + pageSize);
  if (pageIds.length === 0) {
    return {
      payments: [],
      total: matchingIds.length,
    };
  }

  const bundle = await eraReadClient.fhir.search<PaymentReconciliation>({
    resourceType: 'PaymentReconciliation',
    params: [
      {
        name: '_id',
        value: pageIds.join(','),
      },
      {
        name: '_count',
        value: String(pageIds.length),
      },
    ],
  });
  const byId = new Map(bundle.unbundle().map((pr) => [pr.id, pr]));

  return {
    payments: pageIds.map((id) => byId.get(id)).filter((pr): pr is PaymentReconciliation => !!pr),
    total: matchingIds.length,
  };
}

// For the given claims, return the ids of the PaymentReconciliations that adjudicated them.
async function findEraPaymentReconciliationIds(eraReadClient: Oystehr, claimIds: Set<string>): Promise<Set<string>> {
  const claimResponses: ClaimResponse[] = [];
  const ids = [...claimIds];
  const BATCH = 100;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH).map((id) => `Claim/${id}`);
    const bundle = await eraReadClient.fhir.search<ClaimResponse>({
      resourceType: 'ClaimResponse',
      params: [
        { name: 'request', value: batch.join(',') },
        { name: '_elements', value: 'id,identifier,extension' },
        { name: '_count', value: '1000' },
      ],
    });
    claimResponses.push(...bundle.unbundle());
  }

  const { paymentReconciliations } = await fetchClaimEraLinks(eraReadClient, claimResponses);
  return new Set(paymentReconciliations.map((pr) => pr.id).filter((id): id is string => !!id));
}

async function findMatchingClaimIds(oystehr: Oystehr, params: SearchErasParams): Promise<Set<string>> {
  const baseParams: SearchParam[] = [{ name: '_elements', value: 'id' }];
  if (params.claimStatus)
    baseParams.push({ name: '_tag', value: `${CURRENT_STATUS_TAG_SYSTEM}|${params.claimStatus}` });
  if (params.dosFrom) baseParams.push({ name: 'created', value: `ge${params.dosFrom}` });
  if (params.dosTo) baseParams.push({ name: 'created', value: `le${params.dosTo}` });
  if (params.patientId) baseParams.push({ name: 'patient', value: `Patient/${params.patientId}` });

  const paramsSets: SearchParam[][] = [];
  if (params.searchText) {
    paramsSets.push([...baseParams, { name: 'patient.name', value: params.searchText }]);
    paramsSets.push([
      ...baseParams,
      { name: 'identifier', value: CLAIM_PCN_IDENTIFIER_SYSTEM + '|' + params.searchText },
    ]);
  } else {
    paramsSets.push(baseParams);
  }

  const ids = new Set<string>();
  for (const params of paramsSets) {
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<Claim>({
        resourceType: 'Claim',
        params: [...params, { name: '_count', value: String(count) }, { name: '_offset', value: String(offset) }],
      });
      const page = bundle.unbundle();
      for (const c of page) {
        if (c.id) ids.add(c.id);
      }
      return bundle;
    }, SCAN_PAGE_SIZE);
  }

  return ids;
}

function mapEra(
  pr: PaymentReconciliation,
  payersByRef: Map<string, Organization>,
  claimResponsesByPrId: Map<string, ClaimResponse[]>
): EraListItem {
  const claimResponses = claimResponsesByPrId.get(pr.id ?? '') ?? [];
  const payerRef =
    pr.paymentIssuer?.reference ?? claimResponses.find((cr) => cr.insurer?.reference)?.insurer?.reference;
  const payerOrg = payerRef ? payersByRef.get(payerRef) : undefined;

  const checkNumber = getEraCheckNumber(pr) ?? '';
  const counts = countEraClaims(claimResponses);

  return {
    id: pr.id ?? '',
    checkNumber,
    payerName: payerOrg?.name ?? pr.paymentIssuer?.display ?? '',
    paymentDate: pr.paymentDate ?? pr.created ?? '',
    paymentAmount: pr.paymentAmount?.value ?? 0,
    status: pr.outcome ?? pr.status ?? '',
    claimCount: counts.total,
    matchedCount: counts.matched,
    unmatchedCount: counts.unmatched,
  };
}
