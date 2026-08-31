import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Patient } from 'fhir/r4b';
import { PatientDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { hasReachedPatientAr } from 'utils/lib/types/data/billing/claim-status';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchAllPages } from '../../shared/fhir';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  fetchClaimResponsesByClaimIds,
  fetchPatientPaidByClaimId,
  summarizeClaimPayments,
  summarizePatientBalance,
} from '../claim-amounts';
import {
  createBillingClient,
  fetchById,
  formatAddress,
  getClaimStatus,
  patientSearchParam,
  resolveClinicalPatientIds,
  resolveLinkedPatientIds,
  resolvePayersByRef,
  toAddressParts,
} from '../shared';
import { GetPatientDetailParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-patient-detail';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: GetPatientDetailParams): Promise<PatientDetailResponse> {
  const patient = await fetchById<Patient>(oystehr, 'Patient', params.patientId);

  const { claims, balance } = await fetchPatientClaims(oystehr, params.patientId);

  const {
    clinicalId,
    clinicalFriendlyId,
    workingCopyParentId: workingCopyReferenceResourceId,
  } = await resolveClinicalPatientIds({
    oystehr,
    patient,
  });
  const phone = patient.telecom?.find((t) => t.system === 'phone')?.value ?? '';
  const email = patient.telecom?.find((t) => t.system === 'email')?.value ?? '';
  const addr = patient.address?.[0];

  return {
    id: patient.id ?? '',
    firstName: patient.name?.[0]?.given?.join(' ') ?? '',
    lastName: patient.name?.[0]?.family ?? '',
    dob: patient.birthDate ?? '',
    gender: patient.gender ?? '',
    phone,
    email,
    address: formatAddress(addr),
    addressParts: toAddressParts(addr),
    clinicalId: clinicalId ?? '',
    clinicalFriendlyId: clinicalFriendlyId ?? '',
    workingCopyReferenceResourceId,
    active: patient.active !== false,
    balance,
    claims,
  };
}

async function fetchPatientClaims(
  oystehr: Oystehr,
  patientId: string
): Promise<{
  claims: PatientDetailResponse['claims'];
  balance: PatientDetailResponse['balance'];
}> {
  const patientIds = await resolveLinkedPatientIds({
    oystehr,
    patientId,
  });

  const claims: Claim[] = [];

  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        patientSearchParam(patientIds),
        { name: '_sort', value: '-created' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    claims.push(...bundle.unbundle());
    return bundle;
  }, 100);

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

  const summaries = claims.map((c) =>
    summarizeClaimPayments(
      claimResponsesByClaimId.get(c.id ?? '') ?? [],
      c.total?.value ?? 0,
      patientPaidByClaimId.get(c.id ?? '') ?? 0
    )
  );

  const claimItems = claims.map((c, idx) => {
    const payments = summaries[idx];
    return {
      id: c.id ?? '',
      status: getClaimStatus(c),
      serviceDate: c.item?.[0]?.servicedPeriod?.start ?? c.created ?? '',
      payerName: (c.insurer?.reference ? payersByRef.get(c.insurer.reference) : undefined)?.name ?? '',
      billed: c.total?.value ?? 0,
      allowed: payments.allowed,
      insurancePaid: payments.insurancePaid,
      patientResp: payments.patientResp,
      patientPaid: payments.patientPaid,
    };
  });

  const balance = summarizePatientBalance(
    claims.map((c, idx) => ({
      payments: summaries[idx],
      reachedPatientAr: hasReachedPatientAr(c),
    }))
  );

  return {
    claims: claimItems,
    balance,
  };
}
