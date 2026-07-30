import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient, ProvenanceAgent } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { commitClaimResourceChange, resolveClaimActor } from '../provenance';
import { buildAddress, createBillingClient, fetchById } from '../shared';
import { UpdateBillingPatientParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  // A claim-scoped edit (the claim screen editing the claim's patient working copy) is recorded in
  // that claim's history, so it needs the acting user; master-screen edits carry no claim context
  // and keep working without a resolvable caller.
  const agent = params.claimId
    ? await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets)
    : undefined;

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: UpdateBillingPatientParams,
  agent?: ProvenanceAgent
): Promise<{ id: string }> {
  const patient = await fetchById<Patient>(oystehr, 'Patient', params.patientId);
  const before = structuredClone(patient);

  patient.name = [{ family: params.lastName, given: [params.firstName] }];

  if (params.dob) patient.birthDate = params.dob;
  else delete patient.birthDate;

  if (params.gender) patient.gender = params.gender;
  else delete patient.gender;

  let telecom = [...(patient.telecom ?? [])];
  const phoneIndex = telecom.findIndex((tel) => tel.system === 'phone');
  if (params.phone) {
    if (phoneIndex >= 0) telecom[phoneIndex] = { system: 'phone', value: params.phone };
    else telecom.push({ system: 'phone', value: params.phone });
  } else {
    telecom = telecom.filter((tel) => tel.system !== 'phone');
  }
  const emailIndex = telecom.findIndex((tel) => tel.system === 'email');
  if (params.email) {
    if (emailIndex >= 0) telecom[emailIndex] = { system: 'email', value: params.email };
    else telecom.push({ system: 'email', value: params.email });
  } else {
    telecom = telecom.filter((tel) => tel.system !== 'email');
  }
  if (telecom.length) patient.telecom = telecom;
  else delete patient.telecom;

  if (params.address) patient.address = [buildAddress(params.address)];
  else delete patient.address;

  if (params.claimId && agent) {
    // Write the update and its claim-history Provenance in one transaction.
    await commitClaimResourceChange(oystehr, {
      resource: patient,
      before,
      agent,
      claimReference: `Claim/${params.claimId}`,
    });
    return { id: params.patientId };
  }

  const updated = await oystehr.fhir.update<Patient>(patient);
  return { id: updated.id! };
}
