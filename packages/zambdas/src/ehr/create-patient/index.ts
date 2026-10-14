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
import { AuditableZambdaEndpoints, createAuditEvent } from '../../shared/userAuditLog';
import { CreatePatientInputValidated, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'create-patient';
let m2mToken = '';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parameters = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);
  const output = await performEffect(parameters, oystehr);
  try {
    await createAuditEvent(
      AuditableZambdaEndpoints.patientCreate,
      oystehr,
      input,
      output.patientId,
      parameters.secrets
    );
  } catch (auditError) {
    // the patient is already created, so don't fail the request
    console.error('Failed to write create-patient audit event:', auditError);
    captureException(auditError);
  }
  return { statusCode: 200, body: JSON.stringify(output) };
});

export async function performEffect(
  input: CreatePatientInputValidated,
  oystehr: Oystehr
): Promise<CreatePatientResponse> {
  const { patient } = input;
  const phoneNumber = formatPhoneNumber(patient.phoneNumber);
  if (!phoneNumber) throw new Error('No phone number found for patient');

  const createPatientRequest = creatingPatientCreateRequest(patient, true);
  if (!createPatientRequest?.fullUrl) throw new Error('Could not build the request to create the patient');
  // No paperwork will set the patient's mobile, so store the account holder's number now.
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
    // An unlinked patient is unbookable and a retry would duplicate it, so roll back.
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
