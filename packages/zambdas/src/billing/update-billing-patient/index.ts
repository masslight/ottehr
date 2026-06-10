import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { UpdateBillingPatientParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: UpdateBillingPatientParams): Promise<{ id: string }> {
  const result = await oystehr.fhir.search<Patient>({
    resourceType: 'Patient',
    params: [{ name: '_id', value: params.patientId }],
  });
  const patient = result.unbundle()[0];
  if (!patient) throw FHIR_RESOURCE_NOT_FOUND('Patient');

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

  if (params.address) {
    const line = [params.address.line1, params.address.line2].filter((l): l is string => !!l);
    patient.address = [
      {
        ...(line.length ? { line } : {}),
        city: params.address.city,
        state: params.address.state,
        postalCode: params.address.postalCode,
      },
    ];
  } else {
    delete patient.address;
  }

  const updated = await oystehr.fhir.update<Patient>(patient);
  return { id: updated.id! };
}
