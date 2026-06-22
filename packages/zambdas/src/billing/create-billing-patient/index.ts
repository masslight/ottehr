import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { buildAddress, createBillingClient } from '../shared';
import { CreateBillingPatientParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-billing-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: CreateBillingPatientParams): Promise<{ id: string }> {
  const patient: Patient = {
    resourceType: 'Patient',
    active: true,
    name: [{ family: params.lastName, given: [params.firstName] }],
  };
  if (params.dob) patient.birthDate = params.dob;
  if (params.gender) patient.gender = params.gender;
  if (params.phone) patient.telecom = [{ system: 'phone', value: params.phone }];
  if (params.address) patient.address = [buildAddress(params.address)];

  const created = await oystehr.fhir.create<Patient>(patient);
  return { id: created.id! };
}
