import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimResponse, Coverage, Patient, PaymentReconciliation } from 'fhir/r4b';
import {
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_PROCESS_PRIORITY,
  codeableConcept,
  EraDetailResponse,
  FHIR_RESOURCE_NOT_FOUND,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  countEraClaims,
  fetchClaimResponsesByPaymentReconciliations,
  isMatchedToClaim,
  sortClaimResponsesByRecency,
  summarizeClaimPayments,
} from '../claim-amounts';
import { buildEraClaimRemit, eraPatientAccountNumber, resolveEraPayee } from '../era-remits';
import {
  createBillingClient,
  createEraReadClient,
  fhirName,
  findRef,
  getEraCheckNumber,
  resolvePayersByRef,
  sortClaimInsurance,
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

export async function performEffect(
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
      const claim = claimResponse.contained?.find((resource) => resource.resourceType === 'Claim') ?? {
        resourceType: 'Claim',
        created: '',
        insurance: [],
        patient: { display: 'Unknown' },
        priority: codeableConcept('normal', CODE_SYSTEM_PROCESS_PRIORITY, 'Normal'),
        provider: { display: 'Unknown' },
        status: 'active',
        type: codeableConcept('unknown', CODE_SYSTEM_CLAIM_TYPE, 'Unknown'),
        use: 'claim',
      };
      const patient: Patient = claimResponse.contained?.find((resource) => resource.resourceType === 'Patient') ?? {
        resourceType: 'Patient',
      };

      const id = 'unmatched-' + claimResponse.id;
      claim.id = id;
      patient.id = id;
      claim.patient.reference = 'Patient/' + id;
      responsesByClaimId.set(id, [claimResponse]);

      claims.push(claim);
      patients.push(patient);
    });

  // Focal coverage per claim -> member id, the same field the claim detail screen shows.
  // Self-pay stubs use logical references (no Coverage/<id>), so they drop out here.
  const coverageIdByClaimId = new Map<string, string>();
  for (const claim of claims) {
    const coverageRef = [...sortClaimInsurance(claim)]
      .sort((a, b) => (b.focal ? 1 : 0) - (a.focal ? 1 : 0))
      .map((entry) => entry.coverage?.reference)
      .find((ref): ref is string => !!ref && ref.startsWith('Coverage/'));
    if (claim.id && coverageRef) coverageIdByClaimId.set(claim.id, coverageRef.replace('Coverage/', ''));
  }
  const coverages: Coverage[] = [];
  const coverageIds = [...new Set(coverageIdByClaimId.values())];
  if (coverageIds.length > 0) {
    const coverageResult = await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [{ name: '_id', value: coverageIds.join(',') }],
    });
    coverages.push(...coverageResult.unbundle());
  }

  const claimItems = claims.map((claim) => {
    const claimResponses = responsesByClaimId.get(claim.id ?? '') ?? [];
    const patient = findRef<Patient>(patients, claim.patient?.reference);
    const matched = !claim.id?.startsWith('unmatched');

    const billed = claim.total?.value ?? 0;
    const payments = summarizeClaimPayments(claimResponses, billed);
    const orderedResponses = sortClaimResponsesByRecency(claimResponses);
    const latestStatus = orderedResponses.at(-1)?.outcome ?? '';

    const coverageId = coverageIdByClaimId.get(claim.id ?? '');
    const coverage = coverageId ? coverages.find((candidate) => candidate.id === coverageId) : undefined;
    const containedCoverage = orderedResponses
      .flatMap((claimResponse) => claimResponse.contained ?? [])
      .find((resource): resource is Coverage => resource.resourceType === 'Coverage');

    return {
      claimId: claim.id ?? '',
      patientName: fhirName(patient),
      patientDob: patient?.birthDate ?? '',
      dos: claim.item?.[0]?.servicedPeriod?.start ?? claim.created ?? '',
      billed,
      allowed: payments.allowed,
      paid: payments.insurancePaid,
      posted: payments.insurancePaid,
      patientResp: payments.patientResp,
      patientAccountNumber: eraPatientAccountNumber(claimResponses, claim, matched),
      memberId: coverage?.subscriberId ?? containedCoverage?.subscriberId ?? '',
      status: latestStatus,
      matched,
      claimResponseIds: orderedResponses
        .map((claimResponse) => claimResponse.id)
        .filter((id): id is string => id != null),
      remits: orderedResponses.map((claimResponse) => buildEraClaimRemit(claimResponse, claim)),
    };
  });

  const checkNumber = getEraCheckNumber(pr) ?? '';
  const counts = countEraClaims(claimResponses);
  const payee = resolveEraPayee(claimResponses);

  return {
    id: pr.id ?? '',
    checkNumber,
    checkDate: pr.paymentDate ?? '',
    createdDate: pr.created ?? '',
    checkAmount: pr.paymentAmount?.value ?? 0,
    payee,
    payerName: payerOrg?.name ?? pr.paymentIssuer?.display ?? '',
    payerFhirId: payerOrg?.id ?? '',
    status: pr.outcome ?? pr.status ?? '',
    // BPR04 (ACH/CHK/NON) is not preserved by either converter: the trace number's system is
    // always the era-check-number system whether the payer sent a check or an EFT, so anything
    // derived from it would be a coin flip. Only a typed payment identifier is a real signal.
    paymentMethod: pr.paymentIdentifier?.type?.coding?.[0]?.code ?? '',
    totalClaims: counts.total,
    matchedClaims: counts.matched,
    unmatchedClaims: counts.unmatched,
    claims: claimItems,
  };
}
