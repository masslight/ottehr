import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { PractitionerRole, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  Closure,
  createOystehrClient,
  FHIR_RESOURCE_NOT_FOUND,
  getClosingTime,
  getOpeningTime,
  getScheduleExtension,
  getSecret,
  getServiceModeFromScheduleOwner,
  getTimezone,
  INVALID_INPUT_ERROR,
  isClosureOverride,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  ScheduleExtension,
  ScheduleOwnerFhirResource,
  SecretsKeys,
  ServiceMode,
  Timezone,
  TIMEZONES,
  WalkinAvailabilityCheckParams,
  WalkinAvailabilityCheckResult,
} from 'utils';
import { getNameForOwner } from '../../../ehr/schedules/shared';
import { getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';

let oystehrToken: string;
export const index = wrapHandler('check-availability', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, input.secrets);
    const projectAPI = getSecret(SecretsKeys.PROJECT_API, input.secrets);
    const basicInput = validateRequestParameters(input);

    console.log('basicInput', JSON.stringify(basicInput));

    if (!oystehrToken) {
      console.log('getting m2m token for service calls');
      oystehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehr = createOystehrClient(oystehrToken, fhirAPI, projectAPI);

    const effectInput = await complexValidation(basicInput, oystehr);

    const response = performEffect(effectInput);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('walkin-check-availability error', error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('walkin-check-availability', error, ENVIRONMENT);
  }
});

const performEffect = (input: EffectInput): WalkinAvailabilityCheckResult => {
  const { scheduleExtension, serviceMode, timezone, scheduleOwnerName, scheduleId } = input;
  // grab everything that is needed to perform the walkin availability check
  const timeNow = DateTime.now().setZone(timezone);
  const tomorrow = timeNow.plus({ days: 1 });
  const todayOpeningTime = getOpeningTime(scheduleExtension, timezone, timeNow);
  const todayClosingTime = getClosingTime(scheduleExtension, timezone, timeNow);

  const prebookStillOpenForToday =
    todayOpeningTime !== undefined && (todayClosingTime === undefined || todayClosingTime > timeNow.plus({ hours: 1 }));

  // todo: consider just sending the closures list and allow the client to check for closure overrides for whichever days
  const officeHasClosureOverrideToday = isClosureOverride(scheduleExtension.closures ?? [], timezone, timeNow);
  const officeHasClosureOverrideTomorrow = isClosureOverride(scheduleExtension.closures ?? [], timezone, tomorrow);

  const officeOpen =
    todayOpeningTime !== undefined &&
    todayOpeningTime <= timeNow &&
    (todayClosingTime === undefined || todayClosingTime > timeNow) &&
    !officeHasClosureOverrideToday;

  const walkinOpen = isWalkinOpen({
    openingTime: todayOpeningTime,
    closingTime: todayClosingTime,
    closures: scheduleExtension.closures ?? [],
    timezone,
    timeNow,
  });

  console.log(
    'officeOpen, walkinOpen, prebookStillOpenForToday, officeHasClosureOverrideToday, officeHasClosureOverrideTomorrow',
    officeOpen,
    walkinOpen,
    prebookStillOpenForToday,
    officeHasClosureOverrideToday,
    officeHasClosureOverrideTomorrow
  );

  return {
    officeOpen,
    walkinOpen,
    officeHasClosureOverrideTomorrow,
    officeHasClosureOverrideToday,
    prebookStillOpenForToday,
    serviceMode,
    scheduleOwnerName,
    scheduleId,
  };
};

type BasicInput = WalkinAvailabilityCheckParams;
const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { scheduleId, locationName } = JSON.parse(input.body);

  if (!scheduleId && !locationName) {
    throw INVALID_INPUT_ERROR('Either "scheduleId" or "scheduleName" must be provided');
  }

  if (scheduleId && isValidUUID(scheduleId) === false) {
    throw INVALID_INPUT_ERROR('"scheduleId" must be a valid UUID');
  }

  if (locationName && typeof locationName !== 'string') {
    throw INVALID_INPUT_ERROR('"scheduleName" must be a string');
  }

  return { scheduleId, locationName };
};

interface EffectInput {
  scheduleExtension: ScheduleExtension;
  timezone: Timezone;
  scheduleOwnerName: string;
  scheduleId: string;
  serviceMode?: ServiceMode;
}
const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId, locationName } = input;

  const params: SearchParam[] = [];

  if (scheduleId) {
    params.push(
      ...[
        {
          name: '_id',
          value: scheduleId,
        },
        {
          name: '_include',
          value: 'Schedule:actor',
        },
      ]
    );
  } else if (locationName) {
    params.push(
      ...[
        {
          name: 'actor:Location.name:exact',
          value: locationName,
        },
        {
          name: '_include',
          value: 'Schedule:actor',
        },
      ]
    );
  } else {
    throw new Error('Validation failed: scheduleId or scheduleName is required');
  }

  const scheduleAndOwnerResults = (
    await oystehr.fhir.search<Schedule | PractitionerRole | ScheduleOwnerFhirResource>({
      resourceType: 'Schedule',
      params,
    })
  ).unbundle();

  let scheduleOwner: ScheduleOwnerFhirResource | undefined;

  // there is an oystehr bug that can cause a schedule to match based on a deleted Location
  // it points to. those deleted locations will not make it into the result set, so filtering like
  // this ensures we do not select an un-cleaned-up schedule that has lost its actor
  const actors = new Set(
    scheduleAndOwnerResults
      .filter((res) => {
        return res.resourceType !== 'Schedule' && res.id !== undefined;
      })
      .map((res) => {
        return `${res.resourceType}/${res.id}`;
      })
  );

  const schedule = scheduleAndOwnerResults.find((res) => {
    return (
      res.resourceType === 'Schedule' &&
      res.actor.some((actor) => {
        return actors.has(actor.reference ?? '');
      })
    );
  }) as Schedule;
  if (!schedule) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }
  console.log('schedule', schedule.id);
  const scheduleOwnerRef = schedule.actor?.[0]?.reference ?? '';
  const [scheduleOwnerType, scheduleOwnerId] = scheduleOwnerRef.split('/');
  if (scheduleOwnerType && scheduleOwnerId) {
    scheduleOwner = scheduleAndOwnerResults.find((res) => {
      return `${res.resourceType}/${res.id}` === scheduleOwnerRef;
    }) as ScheduleOwnerFhirResource;
  }

  let serviceMode: ServiceMode | undefined = undefined;

  if (scheduleOwner) {
    serviceMode = getServiceModeFromScheduleOwner(scheduleOwner);
  }

  const scheduleExtension = getScheduleExtension(schedule);

  if (!scheduleExtension) {
    throw MISSING_SCHEDULE_EXTENSION_ERROR;
  }

  const timezone = getTimezone(schedule) ?? TIMEZONES[0];

  let scheduleOwnerName = '';
  if (locationName) {
    scheduleOwnerName = locationName;
  } else if (scheduleOwner) {
    scheduleOwnerName = getNameForOwner(scheduleOwner);
  }

  let resolvedScheduleId = scheduleId;
  if (!scheduleId) {
    resolvedScheduleId = schedule.id;
  }

  if (!resolvedScheduleId) {
    throw new Error('Schedule ID could not be resolved');
  }

  return { scheduleExtension, timezone, serviceMode, scheduleOwnerName, scheduleId: resolvedScheduleId };
};

interface CheckWalkinOpenInput {
  openingTime: DateTime | undefined;
  closingTime: DateTime | undefined;
  closures: Closure[];
  timezone: Timezone;
  timeNow: DateTime;
  // this optional prop can be used to allow checking in for a walkin/ad-hoc appointment prior to the opening time
  minutesWalkinAvailableBeforeOpening?: number;
}

function isWalkinOpen(input: CheckWalkinOpenInput): boolean {
  const { openingTime, closingTime, closures, timezone, timeNow, minutesWalkinAvailableBeforeOpening = 0 } = input;
  const officeHasClosureOverrideToday = isClosureOverride(closures, timezone, timeNow);

  return (
    openingTime !== undefined &&
    openingTime.minus({ minute: minutesWalkinAvailableBeforeOpening }) <= timeNow &&
    (closingTime === undefined || closingTime > timeNow) &&
    !officeHasClosureOverrideToday
  );
}
