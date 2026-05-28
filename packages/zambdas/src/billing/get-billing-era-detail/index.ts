import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Organization, Patient, PaymentReconciliation } from 'fhir/r4b';
import { EraDetailResponse, FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, ERA_CHECK_SYSTEM, ERA_ID_SYSTEM, fhirName, findRef } from '../shared';
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
  const bundle = await oystehr.fhir.search<PaymentReconciliation | Organization>({
    resourceType: 'PaymentReconciliation',
    params: [
      { name: '_id', value: params.eraId },
      { name: '_include', value: 'PaymentReconciliation:payment-issuer' },
    ],
  });
  const resources = bundle.unbundle();
  const pr = resources.find(
    (r): r is PaymentReconciliation => r.resourceType === 'PaymentReconciliation' && r.id === params.eraId
  );
  if (!pr) throw FHIR_RESOURCE_NOT_FOUND('PaymentReconciliation');

  const payerOrg = resources.find((r): r is Organization => r.resourceType === 'Organization');

  // Find ClaimResponses linked via ERA identifier
  const eraIdValue = pr.identifier?.find((id) => id.system === ERA_ID_SYSTEM)?.value;
  let claimResponses: ClaimResponse[] = [];
  if (eraIdValue) {
    const crResult = await oystehr.fhir.search<ClaimResponse>({
      resourceType: 'ClaimResponse',
      params: [{ name: 'identifier', value: `${ERA_ID_SYSTEM}|${eraIdValue}` }],
    });
    claimResponses = crResult.unbundle();
  }

  // Fetch referenced claims + patients
  const claimIds = [
    ...claimResponses.map((cr) => cr.request?.reference?.replace('Claim/', '')).filter(Boolean),
    ...(pr.detail ?? []).map((d) => d.request?.reference?.replace('Claim/', '')).filter(Boolean),
  ];
  const uniqueClaimIds = [...new Set(claimIds)] as string[];

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

    let paid = 0;
    let allowed = 0;
    if (cr?.total) {
      paid = cr.total.find((t) => t.category?.coding?.[0]?.code === 'paid')?.amount?.value ?? 0;
      allowed = cr.total.find((t) => t.category?.coding?.[0]?.code === 'allowed')?.amount?.value ?? 0;
    }

    return {
      claimId: c.id ?? '',
      patientName: fhirName(patient),
      dos: c.item?.[0]?.servicedPeriod?.start ?? c.created ?? '',
      billed: c.total?.value ?? 0,
      allowed,
      paid,
      posted: paid,
      status: cr?.outcome ?? '',
    };
  });

  const checkNumber = pr.identifier?.find((id) => id.system === ERA_CHECK_SYSTEM)?.value ?? '';
  const claimCount = pr.detail?.length ?? 0;
  const matchedCount = pr.detail?.filter((d) => d.request?.reference).length ?? 0;

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
    totalClaims: claimCount,
    matchedClaims: matchedCount,
    unmatchedClaims: claimCount - matchedCount,
    claims: claimItems,
  };
}
