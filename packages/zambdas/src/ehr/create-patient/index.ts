import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, List, Patient } from 'fhir/r4b';
import { PATIENT_BILLING_ACCOUNT_TYPE } from 'utils/lib/fhir/constants';
import { createPatientDocumentLists } from 'utils/lib/fhir/list';
import { createUserResourcesForPatient } from 'utils/lib/fhir/patient';
import { formatPhoneNumber } from 'utils/lib/helpers/helpers';
import { CreatePatientResponse } from 'utils/lib/types/api/create-patient.types';
import { creatingPatientCreateRequest } from '../../shared/appointment/helpers';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { CreatePatientInputValidated, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'create-patient';
let m2mToken = '';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parameters = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);
  const output = await performEffect(parameters, oystehr);
  return { statusCode: 200, body: JSON.stringify(output) };
});

/**
 * A new patient with no visit: the same patient resources create-appointment makes for a new patient staff
 * add with a visit (Patient, document folders, billing Account, then the account holder's user resources and
 * the friendly id), and nothing that belongs to a visit.
 */
export async function performEffect(
  input: CreatePatientInputValidated,
  oystehr: Oystehr
): Promise<CreatePatientResponse> {
  const { patient } = input;
  const phoneNumber = formatPhoneNumber(patient.phoneNumber);
  if (!phoneNumber) throw new Error('No phone number found for patient');

  const createPatientRequest = creatingPatientCreateRequest(patient, true);
  if (!createPatientRequest?.fullUrl) throw new Error('Could not build the request to create the patient');
  // With a visit, the paperwork defaults the patient's mobile to the account holder's number and saves it on the
  // Patient. There is no paperwork here, so it is stored now: the Patient Information page requires it and the
  // Patients page searches by it.
  createPatientRequest.resource.telecom = [{ system: 'phone', value: phoneNumber }];

  const listRequests = createPatientDocumentLists(createPatientRequest.fullUrl).map(
    (list): BatchInputPostRequest<List> => ({ method: 'POST', url: '/List', resource: list })
  );
  const accountRequest: BatchInputPostRequest<Account> = {
    method: 'POST',
    url: '/Account',
    resource: {
      resourceType: 'Account',
      status: 'active',
      type: { ...PATIENT_BILLING_ACCOUNT_TYPE },
      subject: [{ reference: createPatientRequest.fullUrl }],
    },
  };

  const bundle = await oystehr.fhir.transaction<Patient | List | Account>({
    requests: [createPatientRequest, ...listRequests, accountRequest],
  });
  const patientId = bundle.entry?.find((entry) => entry.resource?.resourceType === 'Patient')?.resource?.id;
  if (!patientId) throw new Error('Patient resource does not have an ID');

  await Promise.all([
    createUserResourcesForPatient(oystehr, patientId, phoneNumber),
    oystehr.fhir.generateFriendlyPatientId({ id: patientId }).catch((error) => {
      console.error(`Failed to generate friendly patient ID for Patient/${patientId}:`, error);
    }),
  ]);

  return { patientId };
}
