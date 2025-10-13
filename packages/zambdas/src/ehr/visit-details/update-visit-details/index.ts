import Oystehr, { BatchInputPatchRequest, User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import {
  BOOKING_CONFIG,
  cleanUpStaffHistoryTag,
  FHIR_EXTENSION,
  FHIR_RESOURCE_NOT_FOUND,
  getCriticalUpdateTagOp,
  getPatchBinary,
  getSecret,
  getUnconfirmedDOBIdx,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
  SecretsKeys,
  UpdateVisitDetailsInput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getUser,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'update-visit-details';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const effectInput = await complexValidation(validatedParameters, oystehr);
    console.log('effectInput', JSON.stringify(effectInput, null, 2));

    await performEffect(effectInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

interface EffectInput extends UpdateVisitDetailsInput {
  patient: Patient;
  user: User;
  appointment: Appointment;
}

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<void> => {
  const { patient, appointment, bookingDetails, user } = input;

  const patchRequests: BatchInputPatchRequest<Appointment | Patient | Encounter>[] = [];
  if (bookingDetails.confirmedDob) {
    // Update the FHIR Patient resource
    const patientPatchOps: Operation[] = [
      {
        op: 'replace',
        path: '/birthDate',
        value: bookingDetails.confirmedDob,
      },
    ];

    const updateTag = getCriticalUpdateTagOp(patient, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
    patientPatchOps.push(updateTag);

    const removeStaffUpdateTagOp = cleanUpStaffHistoryTag(patient, 'dob');
    if (removeStaffUpdateTagOp) patientPatchOps.push(removeStaffUpdateTagOp);

    const patientPatch = getPatchBinary({
      resourceType: 'Patient',
      resourceId: patient.id!,
      patchOperations: patientPatchOps,
    });

    patchRequests.push(patientPatch);

    // Remove dobNotConfirmed extension from Appointment
    const appointmentExt = appointment?.extension;
    const dobNotConfirmedIdx = getUnconfirmedDOBIdx(appointment);

    if (dobNotConfirmedIdx && dobNotConfirmedIdx >= 0) {
      appointmentExt?.splice(dobNotConfirmedIdx, 1);

      const appointmentPatch = getPatchBinary({
        resourceType: 'Appointment',
        resourceId: appointment.id!,
        patchOperations: [
          {
            op: 'replace',
            path: '/extension',
            value: appointmentExt,
          },
        ],
      });

      patchRequests.push(appointmentPatch);
    }
  }
  if (bookingDetails.patientName) {
    const {
      first: patientFirstName,
      middle: patientMiddleName,
      last: patientLastName,
      suffix: patientSuffix,
    } = bookingDetails.patientName;
    const patientPatchOps: Operation[] = [
      {
        op: 'replace',
        path: '/name/0/given/0',
        value: patientFirstName?.trim(),
      },
      {
        op: 'replace',
        path: '/name/0/family',
        value: patientLastName?.trim(),
      },
    ];

    const storedMiddleName = patient?.name?.[0]?.given?.[1];
    if (patientMiddleName && !storedMiddleName) {
      patientPatchOps.push({
        op: 'add',
        path: '/name/0/given/1',
        value: patientMiddleName?.trim(),
      });
    } else if (!patientMiddleName && storedMiddleName) {
      patientPatchOps.push({
        op: 'remove',
        path: '/name/0/given/1',
      });
    } else if (patientMiddleName && storedMiddleName) {
      patientPatchOps.push({
        op: 'replace',
        path: '/name/0/given/1',
        value: patientMiddleName?.trim(),
      });
    }

    const updateTag = getCriticalUpdateTagOp(patient, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
    patientPatchOps.push(updateTag);

    const storedSuffix = patient?.name?.[0]?.suffix?.[0];
    if (patientSuffix && !storedSuffix) {
      patientPatchOps.push({
        op: 'add',
        path: '/name/0/suffix',
        value: [patientSuffix],
      });
    } else if (!patientSuffix && storedSuffix) {
      patientPatchOps.push({
        op: 'remove',
        path: '/name/0/suffix',
      });
    } else if (patientSuffix && storedSuffix) {
      patientPatchOps.push({
        op: 'replace',
        path: '/name/0/suffix',
        value: [patientSuffix],
      });
    }

    const removeStaffUpdateTagOp = cleanUpStaffHistoryTag(patient, 'name');
    if (removeStaffUpdateTagOp) patientPatchOps.push(removeStaffUpdateTagOp);

    patchRequests.push({
      method: 'PATCH',
      url: `/Patient/${patient.id}`,
      operations: patientPatchOps,
    });
  }

  if (bookingDetails.reasonForVisit) {
    const op = appointment.description ? 'replace' : 'add';
    const appointmentPatchOps: Operation[] = [
      {
        op,
        path: '/description',
        value: bookingDetails.reasonForVisit,
      },
    ];
    patchRequests.push({
      method: 'PATCH',
      url: `/Appointment/${appointment.id}`,
      operations: appointmentPatchOps,
    });
  }

  if (bookingDetails.authorizedNonLegalGuardians) {
    const extension = patient.extension || [];
    const extensionIndex = (patient.extension || []).findIndex((ext) => {
      return ext.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url;
    });

    if (extensionIndex > -1) {
      extension[extensionIndex].valueString = bookingDetails.authorizedNonLegalGuardians;
    } else {
      extension.push({
        url: FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url,
        valueString: bookingDetails.authorizedNonLegalGuardians,
      });
    }
    const op = extensionIndex > -1 ? 'replace' : 'add';
    const patientPatchOps: Operation[] = [
      {
        op,
        path: '/extension',
        value: extension,
      },
    ];
    patchRequests.push({
      method: 'PATCH',
      url: `/Patient/${patient.id}`,
      operations: patientPatchOps,
    });
  }
  // Batch Appointment and Patient updates
  await oystehr.fhir.transaction({
    requests: patchRequests,
  });
};

const complexValidation = async (input: Input, oystehr: Oystehr): Promise<EffectInput> => {
  const { appointmentId, userToken } = input;
  const user = await getUser(userToken, input.secrets);
  if (!user) {
    throw new Error('user unexpectedly not found');
  }
  const patientAndThings = (
    await oystehr.fhir.search<Appointment | Patient | Encounter>({
      resourceType: 'Appointment',
      params: [
        { name: '_id', value: appointmentId },
        { name: '_include', value: 'Appointment:patient' },
        { name: '_revinclude', value: 'Encounter:appointment' },
      ],
    })
  ).unbundle();
  const appointment = patientAndThings.find((entry) => entry.resourceType === 'Appointment') as Appointment;
  const patientResource = patientAndThings.find((entry) => entry.resourceType === 'Patient') as Patient;
  const encounterResource = patientAndThings.find((entry) => entry.resourceType === 'Encounter') as Encounter;

  if (!appointment) {
    throw FHIR_RESOURCE_NOT_FOUND('Appointment');
  }
  if (!patientResource || !patientResource.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }
  if (!encounterResource || !encounterResource.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }

  // const selfPay = getPaymentVariantFromEncounter(encounterResource) === PaymentVariant.selfPay;

  return {
    ...input,
    patient: patientResource,
    appointment,
    user,
  };
};

interface Input extends UpdateVisitDetailsInput {
  userToken: string;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): Input => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { appointmentId, bookingDetails } = JSON.parse(input.body);

  if (!appointmentId) {
    throw MISSING_REQUIRED_PARAMETERS(['appointmentId']);
  }

  if (isValidUUID(appointmentId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('appointmentId');
  }

  if (!bookingDetails) {
    throw MISSING_REQUIRED_PARAMETERS(['bookingDetails']);
  }

  if (typeof bookingDetails !== 'object') {
    throw INVALID_INPUT_ERROR('bookingDetails must be an object');
  }

  if (bookingDetails.reasonForVisit && typeof bookingDetails.reasonForVisit !== 'string') {
    throw INVALID_INPUT_ERROR('reasonForVisit must be a string');
  } else if (
    bookingDetails.reasonForVisit &&
    !BOOKING_CONFIG.reasonForVisitOptions.includes(bookingDetails.reasonForVisit)
  ) {
    throw INVALID_INPUT_ERROR(`reasonForVisit, "${bookingDetails.reasonForVisit}", is not a valid option`);
  }

  if (bookingDetails.authorizedNonLegalGuardians && typeof bookingDetails.authorizedNonLegalGuardians !== 'string') {
    throw INVALID_INPUT_ERROR('authorizedNonLegalGuardians must be a string');
  }

  if (bookingDetails.confirmedDob && typeof bookingDetails.confirmedDob !== 'string') {
    throw INVALID_INPUT_ERROR('confirmedDob must be a string');
  }

  if (bookingDetails.patientName && typeof bookingDetails.patientName !== 'object') {
    throw INVALID_INPUT_ERROR('patientName must be an object');
  } else if (bookingDetails.patientName) {
    if (bookingDetails.patientName.first && typeof bookingDetails.patientName.first !== 'string') {
      throw INVALID_INPUT_ERROR('patientName.first must be a string');
    }
    if (bookingDetails.patientName.last && typeof bookingDetails.patientName.last !== 'string') {
      throw INVALID_INPUT_ERROR('patientName.last must be a string');
    }
    if (bookingDetails.patientName.middle && typeof bookingDetails.patientName.middle !== 'string') {
      throw INVALID_INPUT_ERROR('patientName.middle must be a string');
    }
    if (bookingDetails.patientName.suffix && typeof bookingDetails.patientName.suffix !== 'string') {
      throw INVALID_INPUT_ERROR('patientName.suffix must be a string');
    }
  }

  if (
    !bookingDetails.reasonForVisit &&
    !bookingDetails.authorizedNonLegalGuardians &&
    !bookingDetails.confirmedDob &&
    !bookingDetails.patientName
  ) {
    throw INVALID_INPUT_ERROR('at least one field in bookingDetails must be provided');
  }

  return {
    secrets,
    userToken,
    appointmentId,
    bookingDetails,
  };
};
