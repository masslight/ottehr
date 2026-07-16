import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Patient, Person } from 'fhir/r4b';
import { FRIENDLY_PATIENT_ID_SYSTEM_BASE, PatientDetailResponse } from 'utils';
import { checkOrCreateM2MClientToken, fetchAllPages, wrapHandler, ZambdaInput } from '../../shared';
import { fetchClaimResponsesByClaimIds, summarizeClaimPayments } from '../claim-amounts';
import {
  createBillingClient,
  fetchById,
  formatAddress,
  getClaimStatus,
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

  const ids = patient.identifier ?? [];
  const friendlyId = ids.find((id) => id.system?.startsWith(FRIENDLY_PATIENT_ID_SYSTEM_BASE))?.value ?? '';
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
    friendlyId,
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
  let patientIds = [patientId];
  const personResult = await oystehr.fhir.search<Person>({
    resourceType: 'Person',
    params: [{ name: 'link', value: `Patient/${patientId}` }],
  });
  const person = personResult.unbundle()[0];
  if (person?.link) {
    const linkedIds = person.link
      .map((l) => l.target?.reference)
      .filter((ref): ref is string => !!ref && ref.startsWith('Patient/'))
      .map((ref) => ref.replace('Patient/', ''));
    patientIds = [...new Set([...patientIds, ...linkedIds])];
  }

  const patientParam = patientIds.map((pid) => `Patient/${pid}`).join(',');

  const claims: Claim[] = [];

  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: 'patient', value: patientParam },
        { name: '_sort', value: '-created' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    claims.push(...bundle.unbundle());
    return bundle;
  }, 100);

  const [payersByRef, claimResponsesByClaimId] = await Promise.all([
    resolvePayersByRef(
      oystehr,
      claims.map((c) => c.insurer?.reference)
    ),
    fetchClaimResponsesByClaimIds(oystehr, claims.map((c) => c.id).filter(Boolean) as string[]),
  ]);

  const summaries = claims.map((c) =>
    summarizeClaimPayments(claimResponsesByClaimId.get(c.id ?? '') ?? [], c.total?.value ?? 0)
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

  // only adjudicated claims count toward the patient's balance. an un-adjudicated claim's billed
  // amount is pending insurance, not patient-owed
  const adjudicatedBalances = summaries.filter((s) => s.adjudicated).map((s) => s.balance);
  const balance = {
    claimsWithPatientBalance: adjudicatedBalances.filter((b) => b > 0).length,
    pendingPayments: 0,
    currentBalance: adjudicatedBalances.reduce((sum, b) => sum + b, 0),
  };

  return {
    claims: claimItems,
    balance,
  };
}
