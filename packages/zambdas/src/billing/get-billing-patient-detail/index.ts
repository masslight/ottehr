import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Organization, Patient, Person } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, FRIENDLY_PATIENT_ID_SYSTEM_BASE, PatientDetailResponse } from 'utils';
import { checkOrCreateM2MClientToken, fetchAllPages, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, findRef, formatAddress, getClaimStatus } from '../shared';
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
  const result = await oystehr.fhir.search<Patient>({
    resourceType: 'Patient',
    params: [{ name: '_id', value: params.patientId }],
  });
  const patient = result.unbundle()[0];
  if (!patient) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  const claims = await fetchPatientClaims(oystehr, params.patientId);

  const ids = patient.identifier ?? [];
  const friendlyId = ids.find((id) => id.system?.startsWith(FRIENDLY_PATIENT_ID_SYSTEM_BASE))?.value ?? '';
  const phone = patient.telecom?.find((t) => t.system === 'phone')?.value ?? '';
  const email = patient.telecom?.find((t) => t.system === 'email')?.value ?? '';

  return {
    id: patient.id ?? '',
    firstName: patient.name?.[0]?.given?.join(' ') ?? '',
    lastName: patient.name?.[0]?.family ?? '',
    dob: patient.birthDate ?? '',
    gender: patient.gender ?? '',
    phone,
    email,
    address: formatAddress(patient.address?.[0]),
    friendlyId,
    active: patient.active !== false,
    // TODO: wire real balance from ClaimResponse/PaymentReconciliation
    balance: { claimsWithPatientBalance: 0, pendingPayments: 0, currentBalance: 0 },
    claims,
  };
}

async function fetchPatientClaims(oystehr: Oystehr, patientId: string): Promise<PatientDetailResponse['claims']> {
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
  const orgs: Organization[] = [];

  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Claim | Organization>({
      resourceType: 'Claim',
      params: [
        { name: 'patient', value: patientParam },
        { name: '_include', value: 'Claim:insurer' },
        { name: '_sort', value: '-created' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    const page = bundle.unbundle();
    claims.push(...page.filter((r): r is Claim => r.resourceType === 'Claim'));
    orgs.push(...page.filter((r): r is Organization => r.resourceType === 'Organization'));
    return bundle;
  }, 100);

  return claims.map((c) => {
    return {
      id: c.id ?? '',
      status: getClaimStatus(c),
      serviceDate: c.item?.[0]?.servicedPeriod?.start ?? c.created ?? '',
      payerName: findRef<Organization>(orgs, c.insurer?.reference)?.name ?? '',
      billed: c.total?.value ?? 0,
      // TODO: wire from ClaimResponse when available
      allowed: 0,
      insurancePaid: 0,
      patientResp: 0,
      patientPaid: 0,
    };
  });
}
