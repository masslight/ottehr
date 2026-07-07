import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Patient, PaymentReconciliation } from 'fhir/r4b';
import { EraDetailResponse, FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  countEraClaims,
  extractClaimResponseAmounts,
  fetchClaimResponsesByEraIds,
  isMatchedToClaim,
} from '../claim-amounts';
import { createBillingClient, ERA_CHECK_SYSTEM, ERA_ID_SYSTEM, fhirName, findRef, resolvePayersByRef } from '../shared';
import { GetEraDetailParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-era-detail';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: GetEraDetailParams): Promise<EraDetailResponse> {
  const bundle = await oystehr.fhir.search<PaymentReconciliation>({
    resourceType: 'PaymentReconciliation',
    params: [{ name: '_id', value: params.eraId }],
  });
  const pr = bundle.unbundle().find((r) => r.id === params.eraId);
  if (!pr) throw FHIR_RESOURCE_NOT_FOUND('PaymentReconciliation');

  const payersByRef = await resolvePayersByRef(oystehr, [pr.paymentIssuer?.reference]);
  const payerOrg = pr.paymentIssuer?.reference ? payersByRef.get(pr.paymentIssuer.reference) : undefined;

  // Find ClaimResponses linked via ERA identifier
  const eraIdValue = pr.identifier?.find((id) => id.system === ERA_ID_SYSTEM)?.value;
  const claimResponses: ClaimResponse[] = eraIdValue
    ? (await fetchClaimResponsesByEraIds(oystehr, [eraIdValue])).get(eraIdValue) ?? []
    : [];

  // Fetch referenced claims + patients (unmatched responses only carry a contained '#request'
  // claim)
  const claimIds = claimResponses
    .filter(isMatchedToClaim)
    .map((claimResponse) => claimResponse.request?.reference?.replace('Claim/', ''))
    .filter(Boolean) as string[];
  const uniqueClaimIds = [...new Set(claimIds)];

  let claims: Claim[] = [];
  let patients: Patient[] = [];
  if (uniqueClaimIds.length > 0) {
    const claimResult = await oystehr.fhir.search<Claim | Patient>({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: uniqueClaimIds.join(',') },
        { name: '_include', value: 'Claim:patient' },
      ],
    });
    const claimResources = claimResult.unbundle();
    claims = claimResources.filter((r): r is Claim => r.resourceType === 'Claim');
    patients = claimResources.filter((r): r is Patient => r.resourceType === 'Patient');
  }

  const claimItems = claims.map((c) => {
    const cr = claimResponses.find((r) => r.request?.reference === `Claim/${c.id}`);
    const patient = findRef<Patient>(patients, c.patient?.reference);

    const amounts = cr ? extractClaimResponseAmounts(cr) : undefined;
    const paid = amounts?.paid ?? 0;

    return {
      claimId: c.id ?? '',
      patientName: fhirName(patient),
      dos: c.item?.[0]?.servicedPeriod?.start ?? c.created ?? '',
      billed: c.total?.value ?? 0,
      allowed: amounts?.allowed ?? 0,
      paid,
      posted: paid,
      status: cr?.outcome ?? '',
    };
  });

  const checkNumber = pr.identifier?.find((id) => id.system === ERA_CHECK_SYSTEM)?.value ?? '';
  const counts = countEraClaims(claimResponses);

  return {
    id: pr.id ?? '',
    eraId: eraIdValue ?? '',
    checkNumber,
    checkDate: pr.paymentDate ?? '',
    checkAmount: pr.paymentAmount?.value ?? 0,
    payerName: payerOrg?.name ?? pr.paymentIssuer?.display ?? '',
    payerFhirId: payerOrg?.id ?? '',
    status: pr.outcome ?? pr.status ?? '',
    paymentMethod: pr.paymentIdentifier ? (pr.paymentIdentifier.system?.includes('check') ? 'CHK' : 'EFT') : '',
    totalClaims: counts.total,
    matchedClaims: counts.matched,
    unmatchedClaims: counts.unmatched,
    claims: claimItems,
  };
}
