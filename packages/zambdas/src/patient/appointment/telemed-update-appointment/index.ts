import Oystehr, { BatchInput, BatchInputRequest, User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Bundle, Encounter, Patient, Resource } from 'fhir/r4b';
import {
  createOystehrClient,
  FHIR_EXTENSION,
  getPatchBinary,
  getPatchOperationToUpdateExtension,
  RequiredProps,
  UpdateAppointmentRequestParams,
  UpdateAppointmentResponse,
  userHasAccessToPatient,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { getSecret, SecretsKeys, topLevelCatch } from 'zambda-utils';
import { checkOrCreateM2MClientToken, getUser } from '../../shared';
import { createUpdateUserRelatedResources, creatingPatientUpdateRequest } from '../../shared/appointment/helpers';
import { getTelemedLocation } from '../telemed-create-appointment';
import { validateUpdateAppointmentParams } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const validatedParameters = validateUpdateAppointmentParams(input);

    zapehrToken = await checkOrCreateM2MClientToken(zapehrToken, input.secrets);

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
  const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
  const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);
  const oystehr = createOystehrClient(zapehrToken, fhirAPI, projectAPI);
  console.log('getting user');

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);

  if (patient.id) {
    const userAccess = await userHasAccessToPatient(user, patient.id, oystehr);
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

  const { appointmentId } = await updateAppointment(params, oystehr, user);

  const response = { appointmentId };
  console.log(`fhirAppointment = ${JSON.stringify(response)}`, 'Telemed visit');
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
}

export async function updateAppointment(
  params: RequiredProps<UpdateAppointmentRequestParams, 'patient'>,
  oystehr: Oystehr,
  user: User
): Promise<UpdateAppointmentResponse> {
  let updatePatientRequest: BatchInputRequest<Patient> | undefined = undefined;
  const { patient, unconfirmedDateOfBirth, locationState } = params;

  // if it is a returning patient
  const resources = (
    await oystehr.fhir.search<Appointment | Patient | Encounter>({
      resourceType: 'Appointment',
      params: [
        {
          name: '_id',
          value: params.appointmentId,
        },
        {
          name: '_include',
          value: 'Appointment:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Encounter:appointment',
        },
      ],
    })
  ).unbundle();

  const fhirAppointment = resources.find((res) => {
    return res.resourceType === 'Appointment';
  }) as Appointment | undefined;

  const maybeFhirPatient = resources.find((res) => {
    return res.resourceType === 'Patient';
  }) as Patient | undefined;

  const fhirEncounter = resources.find((res) => res.resourceType === 'Encounter') as Encounter | undefined;

  if (!maybeFhirPatient) {
    throw new Error('Patient is not found for the appointment');
  }

  if (!fhirAppointment) {
    throw new Error(`Appointment with provider ID ${params.appointmentId} was not found`);
  }

  if (!fhirEncounter) {
    throw new Error(`Encounter is not found for the appointment ${params.appointmentId}`);
  }

  updatePatientRequest = await creatingPatientUpdateRequest(patient, maybeFhirPatient);

  console.log('performing Transactional Fhir Requests for the appointment');
  if (!patient && !updatePatientRequest) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }

  const patientRequests: BatchInputRequest<Patient>[] = [];
  if (updatePatientRequest) {
    patientRequests.push(updatePatientRequest);
  }

  const patchApptOps: Operation[] = [];

  if (unconfirmedDateOfBirth) {
    const op = getPatchOperationToUpdateExtension(fhirAppointment, {
      url: FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
      valueDate: unconfirmedDateOfBirth,
    });

    if (op) {
      patchApptOps.push(op);
    }
  }

  const transactionInput: BatchInput<Appointment | Patient> = {
    requests: [...patientRequests],
  };

  if (locationState) {
    const location = await getTelemedLocation(oystehr, locationState);
    const locationId = location?.id;

    const locationParticipantIndex = fhirAppointment.participant?.findIndex(
      (p) => p.actor?.reference?.startsWith('Location/')
    );

    if (locationParticipantIndex !== undefined && locationParticipantIndex !== -1) {
      patchApptOps.push({
        op: 'replace',
        path: `/participant/${locationParticipantIndex}/actor/reference`,
        value: `Location/${locationId}`,
      });
    }

    if (fhirEncounter && fhirEncounter.id) {
      const patchEncounterOps: Operation[] = [
        {
          op: 'replace',
          path: '/location/0/location/reference',
          value: `Location/${locationId}`,
        },
      ];

      const patchEncounterReq = getPatchBinary({
        resourceId: fhirEncounter.id,
        resourceType: 'Encounter',
        patchOperations: patchEncounterOps,
      });

      transactionInput.requests.push(patchEncounterReq);
    }
  }

  const patchApptReq: BatchInputRequest<Appointment> | undefined =
    patchApptOps.length > 0
      ? getPatchBinary({ resourceId: params.appointmentId, resourceType: 'Appointment', patchOperations: patchApptOps })
      : undefined;

  if (patchApptReq) {
    transactionInput.requests.push(patchApptReq);
  }

  console.log('making transaction request');
  const bundle = await oystehr.fhir.transaction(transactionInput);
  const { patient: fhirPatient } = extractResourcesFromBundle(bundle, transactionInput, maybeFhirPatient);

  await createUpdateUserRelatedResources(oystehr, patient, fhirPatient, user);

  console.log('success, here is the id: ', fhirAppointment.id);
  const response: UpdateAppointmentResponse = {
    appointmentId: fhirAppointment.id || '',
  };

  return response;
}

interface TransactionOutput {
  appointment: Appointment;
  patient: Patient;
}

const extractResourcesFromBundle = (
  bundle: Bundle<Resource>,
  transactionInput: { requests: BatchInputRequest<Appointment | Patient>[] },
  maybePatient?: Patient
): TransactionOutput => {
  console.log('getting resources from bundle');
  const entry = bundle.entry ?? [];
  const appointment: Appointment = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'Appointment';
  })?.resource as Appointment;

  if (transactionInput.requests.find((req) => req.url.includes('Appointment')) && appointment === undefined) {
    throw new Error('Appointment could not be updated');
  }

  let patient = maybePatient;

  if (!patient) {
    patient = entry.find((enc) => {
      return enc.resource && enc.resource.resourceType === 'Patient';
    })?.resource as Patient;
  }

  if (transactionInput.requests.find((req) => req.url.includes('Patient')) && patient === undefined) {
    throw new Error('Patient could not be updated');
  }
  console.log('successfully obtained resources from bundle');
  return { appointment, patient };
};
