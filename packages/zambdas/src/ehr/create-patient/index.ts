import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, List, Patient, RelatedPerson } from 'fhir/r4b';
import { formatPhoneNumber } from 'utils/lib/helpers/helpers';
import { CreatePatientResponse } from 'utils/lib/types/api/create-patient.types';
import {
  creatingPatientCreateRequest,
  linkNewPatientToAccountHolder,
  makePatientBillingAccountRequest,
  makePatientDocumentListRequests,
} from '../../shared/appointment/helpers';
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
 * the friendly id), built by the same helpers, and nothing that belongs to a visit.
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

  const bundle = await oystehr.fhir.transaction<Patient | List | Account>({
    requests: [
      createPatientRequest,
      ...makePatientDocumentListRequests(createPatientRequest.fullUrl),
      makePatientBillingAccountRequest(createPatientRequest.fullUrl),
    ],
  });
  const created = (bundle.entry ?? []).flatMap((entry) => (entry.resource?.id ? [entry.resource] : []));
  const patientId = created.find((resource) => resource.resourceType === 'Patient')?.id;
  if (!patientId) throw new Error('Patient resource does not have an ID');

  try {
    await linkNewPatientToAccountHolder(oystehr, patientId, phoneNumber);
  } catch (error) {
    // Without an account holder the patient can't be found when adding a visit, and a retry would create a
    // second one. Undo the create so the retry starts clean.
    await deleteCreatedPatient(oystehr, patientId, created).catch((cleanupError) => {
      console.error(
        `Failed to remove Patient/${patientId} after its account holder could not be linked:`,
        cleanupError
      );
      captureException(cleanupError);
    });
    throw error;
  }

  return { patientId };
}

/** Removes what this request created, plus any RelatedPerson the failed linking left behind for the Patient. */
async function deleteCreatedPatient(
  oystehr: Oystehr,
  patientId: string,
  created: (Patient | List | Account)[]
): Promise<void> {
  const relatedPersons = (
    await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [{ name: 'patient', value: `Patient/${patientId}` }],
    })
  ).unbundle();
  await oystehr.fhir.transaction({
    requests: [...relatedPersons, ...created].map(
      (resource): BatchInputDeleteRequest => ({ method: 'DELETE', url: `/${resource.resourceType}/${resource.id}` })
    ),
  });
}
