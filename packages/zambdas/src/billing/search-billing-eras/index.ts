import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Organization, PaymentReconciliation } from 'fhir/r4b';
import { EraListItem } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, ERA_CHECK_SYSTEM, ERA_ID_SYSTEM } from '../shared';
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

  // When claim-level filters are set, find matching claims first, then filter ERAs
  let matchingClaimIds: Set<string> | undefined;
  if (hasClaimFilters) {
    matchingClaimIds = await findMatchingClaimIds(oystehr, params);
    if (matchingClaimIds.size === 0) return { eras: [], total: 0, offset, pageSize };
  }

  // Resolve payer name to org IDs if needed
  let resolvedPayerId = params.payerId;
  if (params.payerName && !resolvedPayerId) {
    const orgResult = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        { name: 'name', value: params.payerName },
        { name: '_count', value: '50' },
      ],
    });
    const orgIds = orgResult
      .unbundle()
      .map((o) => o.id)
      .filter(Boolean) as string[];
    if (orgIds.length === 0) return { eras: [], total: 0, offset, pageSize };
    resolvedPayerId = orgIds.join(',');
  }

  // ERA-level FHIR search with real pagination
  const searchParams: { name: string; value: string }[] = [
    { name: '_sort', value: '-created' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
    { name: '_include', value: 'PaymentReconciliation:payment-issuer' },
  ];
  if (params.eraDateFrom) searchParams.push({ name: 'created', value: `ge${params.eraDateFrom}` });
  if (params.eraDateTo) searchParams.push({ name: 'created', value: `le${params.eraDateTo}` });
  if (params.eraStatus) searchParams.push({ name: 'status', value: params.eraStatus });
  if (resolvedPayerId) searchParams.push({ name: 'payment-issuer', value: resolvedPayerId });
  if (params.checkNumber) searchParams.push({ name: 'identifier', value: `${ERA_CHECK_SYSTEM}|${params.checkNumber}` });
  if (params.eraId) searchParams.push({ name: 'identifier', value: `${ERA_ID_SYSTEM}|${params.eraId}` });

  const bundle = await oystehr.fhir.search<PaymentReconciliation | Organization>({
    resourceType: 'PaymentReconciliation',
    params: searchParams,
  });
  const total = bundle.total ?? 0;

  const resources = (bundle.entry ?? []).map((e) => e.resource).filter(Boolean) as (
    | PaymentReconciliation
    | Organization
  )[];
  const payments = resources.filter((r): r is PaymentReconciliation => r.resourceType === 'PaymentReconciliation');
  const orgs = resources.filter((r): r is Organization => r.resourceType === 'Organization');

  let eras = payments.map((pr) => mapEra(pr, orgs));

  // If claim filters were applied, keep only ERAs that reference at least one matching claim
  if (matchingClaimIds) {
    eras = eras.filter((era) => {
      const pr = payments.find((p) => p.id === era.id);
      return pr?.detail?.some((d) => {
        const claimId = d.request?.reference?.replace('Claim/', '');
        return claimId && matchingClaimIds!.has(claimId);
      });
    });
  }

  return { eras, total, offset, pageSize };
}

async function findMatchingClaimIds(oystehr: Oystehr, params: SearchErasParams): Promise<Set<string>> {
  const claimParams: { name: string; value: string }[] = [
    { name: '_count', value: '200' },
    { name: '_elements', value: 'id' },
  ];
  if (params.claimStatus) claimParams.push({ name: '_tag', value: `current-status|${params.claimStatus}` });
  if (params.dosFrom) claimParams.push({ name: 'created', value: `ge${params.dosFrom}` });
  if (params.dosTo) claimParams.push({ name: 'created', value: `le${params.dosTo}` });
  if (params.patientId) claimParams.push({ name: 'patient', value: `Patient/${params.patientId}` });
  if (params.searchText) claimParams.push({ name: 'patient.name', value: params.searchText });

  const bundle = await oystehr.fhir.search<Claim>({ resourceType: 'Claim', params: claimParams });
  const ids = bundle
    .unbundle()
    .map((c) => c.id)
    .filter(Boolean) as string[];
  return new Set(ids);
}

function mapEra(pr: PaymentReconciliation, orgs: Organization[]): EraListItem {
  const payerRef = pr.paymentIssuer?.reference;
  const payerId = payerRef?.replace('Organization/', '');
  const payerOrg = orgs.find((o) => o.id === payerId);

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
