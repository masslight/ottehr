import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Patient, PaymentReconciliation } from 'fhir/r4b';
import { EraDetailResponse, FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  countEraClaims,
  fetchClaimResponsesByPaymentReconciliations,
  isMatchedToClaim,
  sortClaimResponsesByRecency,
  summarizeClaimPayments,
} from '../claim-amounts';
import {
  createBillingClient,
  createEraReadClient,
  fhirName,
  findRef,
  getEraCheckNumber,
  resolvePayersByRef,
} from '../shared';
import { GetEraDetailParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-era-detail';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const eraReadClient = createEraReadClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, eraReadClient, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: GetEraDetailParams
): Promise<EraDetailResponse> {
  const bundle = await eraReadClient.fhir.search<PaymentReconciliation>({
    resourceType: 'PaymentReconciliation',
    params: [{ name: '_id', value: params.eraId }],
  });
  const pr = bundle.unbundle().find((r) => r.id === params.eraId);
  if (!pr) throw FHIR_RESOURCE_NOT_FOUND('PaymentReconciliation');

  // ClaimResponses linked to this ERA via its era-processing Provenance
  const claimResponses: ClaimResponse[] =
    (await fetchClaimResponsesByPaymentReconciliations(eraReadClient, [pr])).get(pr.id ?? '') ?? [];

  // process-era PaymentReconciliations carry no paymentIssuer; fall back to the payer on the
  // ClaimResponses
  const payersByRef = await resolvePayersByRef(oystehr, [
    pr.paymentIssuer?.reference,
    ...claimResponses.map((cr) => cr.insurer?.reference),
  ]);
  const payerRef =
    pr.paymentIssuer?.reference ?? claimResponses.find((cr) => cr.insurer?.reference)?.insurer?.reference;
  const payerOrg = payerRef ? payersByRef.get(payerRef) : undefined;

  // Group matched responses by claim id; an ERA can adjudicate the same claim more than once
  // (reversal + correction), and unmatched responses only carry a contained '#request' claim so
  // they are excluded here and surface only in the counts below.
  const responsesByClaimId = new Map<string, ClaimResponse[]>();
  for (const claimResponse of claimResponses) {
    if (!isMatchedToClaim(claimResponse)) continue;
    const claimId = claimResponse.request?.reference?.replace('Claim/', '');
    if (!claimId) continue;
    const list = responsesByClaimId.get(claimId) ?? [];
    list.push(claimResponse);
    responsesByClaimId.set(claimId, list);
  }
  const uniqueClaimIds = [...responsesByClaimId.keys()];

  const claims: Claim[] = [];
  const patients: Patient[] = [];
  if (uniqueClaimIds.length > 0) {
    const claimResult = await oystehr.fhir.search<Claim | Patient>({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: uniqueClaimIds.join(',') },
        { name: '_include', value: 'Claim:patient' },
      ],
    });
    const claimResources = claimResult.unbundle();
    claims.push(...claimResources.filter((r): r is Claim => r.resourceType === 'Claim'));
    patients.push(...claimResources.filter((r): r is Patient => r.resourceType === 'Patient'));
  }

  claimResponses
    .filter((claimResponse) => !isMatchedToClaim(claimResponse))
    .forEach((claimResponse) => {
      const claim = claimResponse.contained?.find((resource) => resource.resourceType === 'Claim');
      const patient = claimResponse.contained?.find((resource) => resource.resourceType === 'Patient');
      if (claim && patient) {
        const id = 'unmatched-' + claimResponse.id;
        claim.id = id;
        patient.id = id;
        claim.patient.reference = 'Patient/' + id;
        responsesByClaimId.set(id, [claimResponse]);

        claims.push(claim);
        patients.push(patient);
      }
    });

  const claimItems = claims.map((claim) => {
    const claimResponses = responsesByClaimId.get(claim.id ?? '') ?? [];
    const patient = findRef<Patient>(patients, claim.patient?.reference);

    const billed = claim.total?.value ?? 0;
    const payments = summarizeClaimPayments(claimResponses, billed);
    const latestStatus = sortClaimResponsesByRecency(claimResponses).at(-1)?.outcome ?? '';

    return {
      claimId: claim.id ?? '',
      patientName: fhirName(patient),
      dos: claim.item?.[0]?.servicedPeriod?.start ?? claim.created ?? '',
      billed,
      allowed: payments.allowed,
      paid: payments.insurancePaid,
      posted: payments.insurancePaid,
      status: latestStatus,
      matched: !claim.id?.startsWith('unmatched'),
      claimResponseIds: claimResponses.map((claimResponse) => claimResponse.id).filter((id) => id != null),
    };
  });

  const checkNumber = getEraCheckNumber(pr) ?? '';
  const counts = countEraClaims(claimResponses);

  return {
    id: pr.id ?? '',
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
