import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  CreateSlotParams,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  getTimezone,
  INVALID_INPUT_ERROR,
  isValidUUID,
  makeBookingOriginExtensionEntry,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
  SecretsKeys,
  ServiceMode,
  SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING,
  SLOT_WALKIN_APPOINTMENT_TYPE_CODING,
  SlotServiceCategory,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'create-slot';

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

    const slot = await performEffect(effectInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(slot),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-slot', error, ENVIRONMENT);
  }
});

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<Slot> => {
  const { slot } = input;

  return oystehr.fhir.create<Slot>(slot);
};

interface ApptLengthDef {
  length: number;
  unit: 'minutes' | 'hours';
}

interface BasicInput extends Omit<CreateSlotParams, 'lengthInMinutes' | 'lengthInHours'> {
  secrets: Secrets | null;
  apptLength: ApptLengthDef;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const {
    scheduleId,
    startISO,
    lengthInMinutes,
    lengthInHours,
    status,
    walkin,
    serviceModality,
    postTelemedLabOnly,
    originalBookingUrl,
  } = JSON.parse(input.body);

  // required param checks
  if (!scheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }
  if (!startISO) {
    throw MISSING_REQUIRED_PARAMETERS(['startISO']);
  }
  if (!serviceModality) {
    throw MISSING_REQUIRED_PARAMETERS(['serviceModality']);
  }

  if (isValidUUID(scheduleId) === false) {
    throw INVALID_INPUT_ERROR('"scheduleId" must be a valid UUID');
  }
  if (typeof scheduleId !== 'string') {
    throw INVALID_INPUT_ERROR('"scheduleId" must be a string');
  }
  if (typeof startISO !== 'string') {
    throw INVALID_INPUT_ERROR('"startISO" must be a string');
  }
  const startDate = DateTime.fromISO(startISO);
  if (!startDate || startDate.isValid === false) {
    throw INVALID_INPUT_ERROR('"startISO" must be a valid ISO date');
  }
  const now = DateTime.now();
  if (!walkin && startDate < now) {
    throw INVALID_INPUT_ERROR('"startISO" must be in the future');
  }

  if (status && typeof status !== 'string') {
    throw INVALID_INPUT_ERROR('"status" must be a string');
  }
  if (status && !['busy', 'free', 'busy-unavailable', 'busy-tentative', 'entered-in-error'].includes(status)) {
    throw INVALID_INPUT_ERROR(
      '"status" must be one of: "busy", "free", "busy-unavailable", "busy-tentative", "entered-in-error"'
    );
  }
  if (!lengthInMinutes && !lengthInHours) {
    throw INVALID_INPUT_ERROR(
      'Either "lengthInMinutes" or "lengthInHours" must be provided and must be greater than 0'
    );
  }
  if (lengthInMinutes && lengthInHours) {
    throw INVALID_INPUT_ERROR('Either "lengthInMinutes" or "lengthInHours" must be provided, not both');
  }
  if (lengthInMinutes && typeof lengthInMinutes !== 'number') {
    throw INVALID_INPUT_ERROR('"lengthInMinutes" must be a number');
  }
  if (lengthInHours && typeof lengthInHours !== 'number') {
    throw INVALID_INPUT_ERROR('"lengthInHours" must be a number');
  }
  if (walkin !== undefined && typeof walkin !== 'boolean') {
    throw INVALID_INPUT_ERROR('"walkin" must be a boolean');
  }
  if (postTelemedLabOnly !== undefined && typeof postTelemedLabOnly !== 'boolean') {
    throw INVALID_INPUT_ERROR('"postTelemedLabOnly" must be a boolean');
  }
  if (typeof serviceModality !== 'string') {
    throw INVALID_INPUT_ERROR('"serviceModality" must be a string');
  }
  if (!['in-person', 'virtual'].includes(serviceModality)) {
    throw INVALID_INPUT_ERROR('"serviceModality" must be one of: "in-person", "virtual"');
  }
  if (originalBookingUrl && typeof originalBookingUrl !== 'string') {
    throw INVALID_INPUT_ERROR('if included, "originalBookingUrl must be a string');
  }
  const apptLength: ApptLengthDef = { length: 0, unit: 'minutes' };
  if (lengthInMinutes) {
    apptLength.length = lengthInMinutes;
    apptLength.unit = 'minutes';
  } else {
    apptLength.length = lengthInHours;
    apptLength.unit = 'hours';
  }
  return {
    secrets: input.secrets,
    scheduleId,
    startISO,
    status,
    apptLength,
    walkin: walkin ?? false,
    postTelemedLabOnly: postTelemedLabOnly ?? false,
    serviceModality: serviceModality as ServiceMode,
    originalBookingUrl,
  };
};

interface EffectInput {
  slot: Slot;
}

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId, startISO, apptLength, status, walkin, serviceModality, postTelemedLabOnly, originalBookingUrl } =
    input;
  // query up the schedule that owns the slot
  const schedule: Schedule = await oystehr.fhir.get<Schedule>({ resourceType: 'Schedule', id: scheduleId });
  if (!schedule) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }
  const timezone = getTimezone(schedule);

  const startTime = DateTime.fromISO(startISO);
  const endTime = startTime.plus({ [apptLength.unit]: apptLength.length });

  const start = startTime.setZone(timezone).toISO();
  const end = endTime.setZone(timezone).toISO();

  if (!start || !end) {
    throw INVALID_INPUT_ERROR('Unable to create start and end times');
  }

  const serviceCategory =
    serviceModality === ServiceMode['in-person']
      ? [SlotServiceCategory.inPersonServiceMode]
      : [SlotServiceCategory.virtualServiceMode];
  let extension: Slot['extension'];
  if (originalBookingUrl) {
    extension = [makeBookingOriginExtensionEntry(originalBookingUrl)];
  }
  const slot: Slot = {
    resourceType: 'Slot',
    status: status ?? 'busy',
    start,
    end,
    serviceCategory,
    schedule: {
      reference: `Schedule/${schedule.id}`,
    },
    extension,
  };
  if (walkin) {
    slot.appointmentType = { ...SLOT_WALKIN_APPOINTMENT_TYPE_CODING };
  } else if (postTelemedLabOnly) {
    slot.appointmentType = { ...SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING };
  }
  // optional: check if the schedule owner permits the provided service modality
  // we do this instead at appointment creation time
  return { slot };
};
