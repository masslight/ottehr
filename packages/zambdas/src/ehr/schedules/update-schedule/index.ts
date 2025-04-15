import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Closure,
  DailySchedule,
  getScheduleDetails,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  OTTEHR_SLUG_ID_SYSTEM,
  SCHEDULE_EXTENSION_URL,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleExtension,
  ScheduleOverrides,
  ScheduleOwnerFhirResource,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import { Extension, Schedule } from 'fhir/r4b';
import { UpdateScheduleBasicInput, validateUpdateScheduleParameters } from '../shared';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateUpdateScheduleParameters(input);
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
  const { updateDetails, currentSchedule, definiteDailySchedule, owner } = input;
  const { schedule: newSchedule, scheduleOverrides, closures, timezone, ownerSlug } = updateDetails;
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
  // todo: this isn't very "RESTful" but works for now while further decoupling the schedule from the owner is on the docket
  // for next dev cycle. note timezone is duplicaton on both schedule and owner for now.
  console.log('owner slug', ownerSlug);
  if (owner && (timezone || ownerSlug)) {
    const ownerExtension = (owner.extension ?? []).filter((ext: Extension) => {
      if (ext.url === TIMEZONE_EXTENSION_URL) {
        return false;
      }
      return true;
    });
    const ownerIdentifier = (owner.identifier ?? []).filter((id) => id.system !== OTTEHR_SLUG_ID_SYSTEM);
    if (timezone) {
      ownerExtension.push({
        url: TIMEZONE_EXTENSION_URL,
        valueString: timezone,
      });
    }
    if (ownerSlug) {
      ownerIdentifier.push({
        system: OTTEHR_SLUG_ID_SYSTEM,
        value: ownerSlug,
      });
    }
    await oystehr.fhir.update({
      ...owner,
      extension: ownerExtension,
      identifier: ownerIdentifier,
    });
  }

  // console.log('newExtension', JSON.stringify(newExtension, null, 2));
  return await oystehr.fhir.update<Schedule>({
    ...currentSchedule,
    extension: newExtension,
  });
};

interface EffectInput {
  updateDetails: {
    timezone?: string;
    schedule?: DailySchedule;
    scheduleOverrides?: ScheduleOverrides;
    closures?: Closure[];
    ownerSlug: string | undefined;
  };
  definiteDailySchedule: DailySchedule;
  currentSchedule: Schedule;
  owner: ScheduleOwnerFhirResource | undefined;
}

const complexValidation = async (input: UpdateScheduleBasicInput, oystehr: Oystehr): Promise<EffectInput> => {
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

  const [actorType, actorId] = (schedule.actor ?? [])[0]?.reference?.split('/') ?? [];
  console.log('actorType, actorId', actorType, actorId);
  let owner: ScheduleOwnerFhirResource | undefined;
  if (actorType === 'Location' || actorType === 'HealthcareService' || actorType === 'Practitioner') {
    owner = await oystehr.fhir.get<ScheduleOwnerFhirResource>({ resourceType: actorType, id: actorId });
  }

  return {
    currentSchedule: schedule,
    updateDetails: {
      timezone: timezone,
      schedule: scheduleInput,
      scheduleOverrides,
      closures,
      ownerSlug: input.slug,
    },
    definiteDailySchedule,
    owner,
  };
};
