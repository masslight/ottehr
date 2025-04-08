import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Closure,
  ClosureType,
  DailySchedule,
  getScheduleDetails,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  SCHEDULE_EXTENSION_URL,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleExtension,
  ScheduleOverrides,
  Secrets,
  TIMEZONE_EXTENSION_URL,
  TIMEZONES,
  UpdateScheduleParams,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import { Extension, Schedule } from 'fhir/r4b';

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

    const updatedSchedule = await performEffect(effectInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(updatedSchedule),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return topLevelCatch('get-patient-account', error, input.secrets);
  }
};

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<Schedule> => {
  const { updateDetails, currentSchedule, definiteDailySchedule } = input;
  const { schedule: newSchedule, scheduleOverrides, closures, timezone } = updateDetails;
  const scheduleExtension: ScheduleExtension = getScheduleDetails(currentSchedule) ?? {
    schedule: definiteDailySchedule,
    closures,
    scheduleOverrides: {},
  };
  // console.log('new schedule', JSON.stringify(newSchedule, null, 2));
  if (newSchedule !== undefined) {
    scheduleExtension.schedule = newSchedule;
  }
  console.log('scheduleOverrides', JSON.stringify(scheduleOverrides, null, 2));
  if (scheduleOverrides !== undefined) {
    scheduleExtension.scheduleOverrides = scheduleOverrides;
  }
  if (closures !== undefined) {
    scheduleExtension.closures = closures;
  }
  const newExtension = (currentSchedule.extension ?? []).filter((ext: Extension) => {
    if (ext.url === SCHEDULE_EXTENSION_URL) {
      return false;
    }
    if (timezone !== undefined && ext.url === TIMEZONE_EXTENSION_URL) {
      return false;
    }
    return true;
  });
  // console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
  const scheduleJson = JSON.stringify(scheduleExtension);
  newExtension.push({
    url: SCHEDULE_EXTENSION_URL,
    valueString: scheduleJson,
  });
  if (timezone) {
    newExtension.push({
      url: TIMEZONE_EXTENSION_URL,
      valueString: timezone,
    });
  }
  console.log('newExtension', JSON.stringify(newExtension, null, 2));
  return await oystehr.fhir.update<Schedule>({
    ...currentSchedule,
    extension: newExtension,
  });
};

interface BasicInput extends UpdateScheduleParams {
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { scheduleId, timezone, schedule, scheduleOverrides, closures } = JSON.parse(input.body);

  if (!scheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }

  if (isValidUUID(scheduleId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('scheduleId');
  }

  if (timezone) {
    if (typeof timezone !== 'string') {
      throw INVALID_INPUT_ERROR('"timezone" must be a string');
    }
    if (TIMEZONES.includes(timezone) === false) {
      throw INVALID_INPUT_ERROR(`"timezone" must be one of ${TIMEZONES.join(', ')}`);
    }
  }
  // todo: better schema application for these complex structures
  if (schedule) {
    if (typeof schedule !== 'object') {
      throw INVALID_INPUT_ERROR('"schedule" must be an object');
    }
  }
  if (scheduleOverrides) {
    if (typeof scheduleOverrides !== 'object') {
      throw INVALID_INPUT_ERROR('"scheduleOverrides" must be an object');
    }
  }
  if (closures) {
    if (!Array.isArray(closures)) {
      throw INVALID_INPUT_ERROR('"closures" must be an array');
    }
    closures.forEach((closure) => {
      if (typeof closure !== 'object') {
        throw INVALID_INPUT_ERROR('"closures" must be an array of objects');
      }
      if (!closure.start || !closure.end) {
        throw INVALID_INPUT_ERROR('"closures" must be an array of objects with start and end');
      }
      if (Object.values(ClosureType).includes(closure.type) === false) {
        throw INVALID_INPUT_ERROR(
          `"closures" must be an array of objects with a type of ${Object.values(ClosureType).join(', ')}`
        );
      }
    });
  }

  return {
    secrets,
    scheduleId,
    timezone,
    schedule,
    scheduleOverrides,
    closures,
  };
};

interface EffectInput {
  updateDetails: {
    timezone?: string;
    schedule?: DailySchedule;
    scheduleOverrides?: ScheduleOverrides;
    closures?: Closure[];
  };
  definiteDailySchedule: DailySchedule;
  currentSchedule: Schedule;
}

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId, timezone, schedule: scheduleInput, scheduleOverrides, closures } = input;
  let definiteDailySchedule: DailySchedule;
  const schedule = await oystehr.fhir.get<Schedule>({ resourceType: 'Schedule', id: scheduleId });
  if (!schedule || !schedule.id) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  if (scheduleInput === undefined) {
    const scheduleExtension = getScheduleDetails(schedule);
    if (!scheduleExtension) {
      throw MISSING_SCHEDULE_EXTENSION_ERROR;
    }
    definiteDailySchedule = scheduleExtension.schedule;
  } else {
    definiteDailySchedule = scheduleInput;
  }

  return {
    currentSchedule: schedule,
    updateDetails: {
      timezone: timezone,
      schedule: scheduleInput,
      scheduleOverrides,
      closures,
    },
    definiteDailySchedule,
  };
};
