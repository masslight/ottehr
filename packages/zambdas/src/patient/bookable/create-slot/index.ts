import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  checkSlotAvailable,
  CreateSlotParams,
  FHIR_RESOURCE_NOT_FOUND,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
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

  const { scheduleId, startISO, lengthInMinutes, lengthInHours, status, walkin, serviceModality } = JSON.parse(
    input.body
  );

  if (!scheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }
  if (isValidUUID(scheduleId) === false) {
    throw INVALID_INPUT_ERROR('"scheduleId" must be a valid UUID');
  }
  if (!startISO) {
    throw MISSING_REQUIRED_PARAMETERS(['startISO']);
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
  if (serviceModality && typeof serviceModality !== 'string') {
    throw INVALID_INPUT_ERROR('"serviceModality" must be a string');
  }
  if (serviceModality && !['in-person', 'virtual'].includes(serviceModality)) {
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
    serviceModality,
  };
};

interface EffectInput {
  slot: Slot;
}

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId, startISO, apptLength, status, walkin } = input;
  // query up the schedule that owns the slot
  const schedule: Schedule = await oystehr.fhir.get<Schedule>({ resourceType: 'Schedule', id: scheduleId });
  if (!schedule) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }

  const startTime = DateTime.fromISO(startISO);
  const endTime = startTime.plus({ [apptLength.unit]: apptLength.length });

  const start = startTime.toISO();
  const end = endTime.toISO();

  if (!start || !end) {
    throw INVALID_INPUT_ERROR('Unable to create start and end times');
  }

  const slot: Slot = {
    resourceType: 'Slot',
    status: status ?? 'busy',
    start,
    end,
    schedule: {
      reference: `Schedule/${schedule.id}`,
    },
  };
  if (walkin) {
    // todo: define a const somewhere so this can be safely checked for elsewhere
    slot.appointmentType = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
          code: 'WALKIN',
        },
      ],
    };
  }

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

  return { slot };
};
