import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  checkSlotAvailable,
  CreateSlotParams,
  FHIR_RESOURCE_NOT_FOUND,
  getTimezone,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
  ServiceMode,
  SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING,
  SLOT_WALKIN_APPOINTMENT_TYPE_CODING,
  SlotServiceCategory,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import { Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
    const effectInput = await complexValidation(validatedParameters, oystehr);

    const slot = await performEffect(effectInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(slot),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch('create-slot', error, input.secrets);
  }
};

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

  const { scheduleId, startISO, lengthInMinutes, lengthInHours, status, walkin, serviceModality, postTelemedLabOnly } =
    JSON.parse(input.body);

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
  };
};

interface EffectInput {
  slot: Slot;
}

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId, startISO, apptLength, status, walkin, serviceModality, postTelemedLabOnly } = input;
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
  const slot: Slot = {
    resourceType: 'Slot',
    status: status ?? 'busy',
    start,
    end,
    serviceCategory,
    schedule: {
      reference: `Schedule/${schedule.id}`,
    },
  };
  if (walkin) {
    slot.appointmentType = { ...SLOT_WALKIN_APPOINTMENT_TYPE_CODING };
  } else if (postTelemedLabOnly) {
    slot.appointmentType = { ...SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING };
    // todo 1.8-9: check if post-telemed lab only slot is available
  } else {
    // check if slot is available
    const isAvailable = await checkSlotAvailable(
      {
        slot,
        schedule,
      },
      oystehr
    );
    if (!isAvailable) {
      // todo: better custom error here
      throw INVALID_INPUT_ERROR('Slot is not available');
    }
  }

  // optional: check if the schedule owner permits the provided service modality
  // we do this instead at appointment creation time

  return { slot };
};
