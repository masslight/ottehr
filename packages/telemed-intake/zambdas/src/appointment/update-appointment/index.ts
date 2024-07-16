import { BatchInputRequest, FhirClient, User } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Bundle, Patient, Resource } from 'fhir/r4';
import {
  FHIR_EXTENSION,
  PatientInfo,
  RequiredProps,
  SecretsKeys,
  UpdateAppointmentRequestParams,
  UpdateAppointmentResponse,
  ZambdaInput,
  ageIsInRange,
  createFhirClient,
  getPatchBinary,
  getPatchOperationToUpdateExtension,
  getSecret,
  topLevelCatch,
} from 'ottehr-utils';
import { getUser } from '../../shared/auth';
import { userHasAccessToPatient } from '../../shared/patients';

import { Operation } from 'fast-json-patch';
import { MAXIMUM_AGE, MINIMUM_AGE } from '../../shared';
import { createUpdateUserRelatedResources, creatingPatientUpdateRequest } from '../../shared/appointment/helpers';
import { checkOrCreateToken } from '../lib/utils';
import { validateUpdateAppointmentParams } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const validatedParameters = validateUpdateAppointmentParams(input);

    validateInternalInformation(validatedParameters.patient);

    zapehrToken = await checkOrCreateToken(zapehrToken, input.secrets);

    const response = await performEffect({ input, params: validatedParameters });

    return response;
  } catch (error: any) {
    await topLevelCatch('update-appointment', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

interface PerformEffectInputProps {
  input: ZambdaInput;
  params: RequiredProps<UpdateAppointmentRequestParams, 'patient'>;
}

async function performEffect(props: PerformEffectInputProps): Promise<APIGatewayProxyResult> {
  const { input, params } = props;
  const { patient } = params;
  const { secrets } = input;
  const fhirClient = createFhirClient(zapehrToken);
  console.log('getting user');

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''));

  if (patient.id) {
    const userAccess = await userHasAccessToPatient(user, patient.id, fhirClient);
    if (!userAccess) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: 'User does not have permission to access this patient',
        }),
      };
    }
  }
  console.log('updating appointment');

  const { appointmentId } = await updateAppointment(params, fhirClient, user);

  const response = { appointmentId };
  console.log(`fhirAppointment = ${JSON.stringify(response)}`, 'Telemed visit');
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
}

export async function updateAppointment(
  params: RequiredProps<UpdateAppointmentRequestParams, 'patient'>,
  fhirClient: FhirClient,
  user: User,
): Promise<UpdateAppointmentResponse> {
  let updatePatientRequest: BatchInputRequest | undefined = undefined;
  const { patient, unconfirmedDateOfBirth } = params;

  // if it is a returning patient
  const resources = await fhirClient.searchResources<Resource>({
    resourceType: 'Appointment',
    searchParams: [
      {
        name: '_id',
        value: params.appointmentId,
      },

      {
        name: '_include',
        value: 'Appointment:patient',
      },
    ],
  });

  const fhirAppointment = resources.find((res) => {
    return res.resourceType === 'Appointment';
  }) as Appointment | undefined;

  const maybeFhirPatient = resources.find((res) => {
    return res.resourceType === 'Patient';
  }) as Patient | undefined;

  if (!maybeFhirPatient) {
    throw new Error('Patient is not found for the appointment');
  }

  if (!fhirAppointment) {
    throw new Error(`Appointment with provider ID ${params.appointmentId} was not found`);
  }

  updatePatientRequest = await creatingPatientUpdateRequest(patient, maybeFhirPatient);

  console.log('performing Transactional Fhir Requests for the appointment');
  if (!patient && !updatePatientRequest) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }

  const patientRequests: BatchInputRequest[] = [];
  if (updatePatientRequest) {
    patientRequests.push(updatePatientRequest);
  }

  const patchApptOps: Operation[] = [];

  const unconfirmedDateOfBirthExt = {
    url: FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
    valueString: Boolean(unconfirmedDateOfBirth).toString(),
  };

  const op = getPatchOperationToUpdateExtension(fhirAppointment, unconfirmedDateOfBirthExt);
  if (op) {
    patchApptOps.push(op);
  }

  const patchApptReq: BatchInputRequest | undefined =
    patchApptOps.length > 0
      ? getPatchBinary({ resourceId: params.appointmentId, resourceType: 'Appointment', patchOperations: patchApptOps })
      : undefined;

  const transactionInput = {
    requests: [...patientRequests],
  };
  if (patchApptReq) {
    transactionInput.requests.push(patchApptReq);
  }
  console.log('making transaction request');
  const bundle = await fhirClient.transactionRequest(transactionInput);
  const { patient: fhirPatient } = extractResourcesFromBundle(bundle, maybeFhirPatient);

  await createUpdateUserRelatedResources(fhirClient, patient, fhirPatient, user);

  console.log('success, here is the id: ', fhirAppointment.id);
  const response: UpdateAppointmentResponse = {
    appointmentId: fhirAppointment.id || '',
  };

  return response;
}

function validateInternalInformation(patient: PatientInfo): void {
  if (patient.dateOfBirth && !ageIsInRange(patient.dateOfBirth, MINIMUM_AGE, MAXIMUM_AGE).result) {
    throw new Error(`age not inside range of ${MINIMUM_AGE} to ${MAXIMUM_AGE}`);
  }
}

interface TransactionOutput {
  appointment: Appointment;
  patient: Patient;
}

const extractResourcesFromBundle = (bundle: Bundle<Resource>, maybePatient?: Patient): TransactionOutput => {
  console.log('getting resources from bundle');
  const entry = bundle.entry ?? [];
  const appointment: Appointment = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'Appointment';
  })?.resource as Appointment;

  if (appointment === undefined) {
    throw new Error('Appointment could not be created');
  }

  let patient = maybePatient;

  if (!patient) {
    patient = entry.find((enc) => {
      return enc.resource && enc.resource.resourceType === 'Patient';
    })?.resource as Patient;
  }

  if (patient === undefined) {
    throw new Error('Patient could not be created');
  }
  console.log('successfully obtained resources from bundle');
  return { appointment, patient };
};
