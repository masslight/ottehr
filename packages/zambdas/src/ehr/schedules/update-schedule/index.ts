import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, Schedule } from 'fhir/r4b';
import {
  Closure,
  DailySchedule,
  getScheduleExtension,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  SCHEDULE_EXTENSION_URL,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleExtension,
  ScheduleOverrides,
  ScheduleOwnerFhirResource,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { UpdateScheduleBasicInput, validateUpdateScheduleParameters } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'update-schedule';

// This zambda owns the *schedule-level* fields only: the schedule extension (hours/overrides/
// closures), the timezone (mirrored onto the owner), and the owner's slug identifier. The
// intrinsic Location fields (service modes, payment ids, rooms, name, description, address,
// telecom, reviewLink) are edited via the pure, Schedule-independent update-location zambda.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateUpdateScheduleParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const effectInput = await complexValidation(validatedParameters, oystehr);

  const updatedSchedule = await performEffect(effectInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(updatedSchedule),
  };
});

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<Schedule> => {
  const { updateDetails, currentSchedule, definiteDailySchedule, owner } = input;
  const { schedule: newSchedule, scheduleOverrides, closures, timezone, ownerSlug } = updateDetails;
  const scheduleExtension: ScheduleExtension = getScheduleExtension(currentSchedule) ?? {
    schedule: definiteDailySchedule,
    closures,
    scheduleOverrides: {},
  };
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
  const scheduleJson = JSON.stringify(scheduleExtension);
  newExtension.push({
    url: SCHEDULE_EXTENSION_URL,
    valueString: scheduleJson,
  });
  if (timezone !== undefined) {
    // Validator guarantees a non-empty IANA tz string here; the strict-undefined check is
    // intentional so the truthy fast-path can't accidentally re-introduce an empty-string wipe.
    newExtension.push({
      url: TIMEZONE_EXTENSION_URL,
      valueString: timezone,
    });
  }
  // Mirror timezone + slug onto the owner. Timezone is duplicated on both the schedule and its
  // owner for now; further decoupling the schedule from the owner is a potential future task.
  console.log('owner slug', ownerSlug);
  if (owner && (timezone !== undefined || ownerSlug !== undefined)) {
    // Preserve the existing timezone extension unless the caller is explicitly updating it.
    const ownerExtension = (owner.extension ?? []).filter((ext: Extension) => {
      if (timezone !== undefined && ext.url === TIMEZONE_EXTENSION_URL) {
        return false;
      }
      return true;
    });
    // Preserve existing slug identifier unless caller is explicitly updating slug
    // (undefined = preserve, empty string = clear, non-empty = replace).
    const ownerIdentifier = (owner.identifier ?? []).filter((id) =>
      ownerSlug !== undefined ? id.system !== SLUG_SYSTEM : true
    );
    if (timezone !== undefined) {
      ownerExtension.push({
        url: TIMEZONE_EXTENSION_URL,
        valueString: timezone,
      });
    }
    if (ownerSlug) {
      ownerIdentifier.push({
        system: SLUG_SYSTEM,
        value: ownerSlug,
      });
    }
    const ownerUpdate: ScheduleOwnerFhirResource = {
      ...owner,
      extension: ownerExtension,
      identifier: ownerIdentifier,
    };
    await oystehr.fhir.update(ownerUpdate);
  }

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
    const scheduleExtension = getScheduleExtension(schedule);
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
  if (
    actorType === 'Location' ||
    actorType === 'HealthcareService' ||
    actorType === 'Practitioner' ||
    actorType === 'PractitionerRole'
  ) {
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
