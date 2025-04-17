import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { LocationHoursOfOperation, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  applyOverridesToOperatingHours,
  Closure,
  createOystehrClient,
  FHIR_RESOURCE_NOT_FOUND,
  getLocationHoursFromScheduleExtension,
  getScheduleDetails,
  getSecret,
  getServiceModeFromScheduleOwner,
  getTimezone,
  GetWalkinStartParams,
  HOURS_OF_OPERATION_FORMAT,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  OVERRIDE_DATE_FORMAT,
  ScheduleExtension,
  ScheduleOwnerFhirResource,
  SecretsKeys,
  ServiceMode,
  Timezone,
  TIMEZONES,
  WalkinAvailabilityCheckResult,
} from 'utils';
import { ZambdaInput, getAuth0Token, topLevelCatch } from '../../../shared';
import { DateTime } from 'luxon';

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, input.secrets);
    const projectAPI = getSecret(SecretsKeys.PROJECT_API, input.secrets);
    const basicInput = validateRequestParameters(input);

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehr = createOystehrClient(zapehrToken, fhirAPI, projectAPI);

    const effectInput = await complexValidation(basicInput, oystehr);

    const response = performEffect(effectInput);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Failed to get bookables', error);
    return topLevelCatch('list-bookables', error, input.secrets);
  }
};

const performEffect = (input: EffectInput): WalkinAvailabilityCheckResult => {
  const { scheduleExtension, serviceMode, timezone } = input;
  // grab everything that is needed to perform the walkin availability check
  const timeNow = DateTime.now().setZone(timezone);
  const tomorrow = timeNow.plus({ days: 1 });
  //const tomorrowOpeningTime = getOpeningTime(scheduleExtension.schedule, timezone, tomorrow);
  const rawHoursOfOperation = getLocationHoursFromScheduleExtension(scheduleExtension);
  const hoursOfOperation = applyOverridesToOperatingHours({
    hoursOfOperation: rawHoursOfOperation,
    timezone,
    from: timeNow,
    scheduleOverrides: scheduleExtension.scheduleOverrides,
  });
  const todayOpeningTime = getOpeningTime(hoursOfOperation, timezone, timeNow);
  const todayClosingTime = getClosingTime(hoursOfOperation, timezone, timeNow);

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
  };
};

type BasicInput = GetWalkinStartParams;
const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { scheduleId } = JSON.parse(input.body);

  if (!scheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }

  if (isValidUUID(scheduleId) === false) {
    throw INVALID_INPUT_ERROR('"scheduleId" must be a valid UUID');
  }

  return { scheduleId };
};

interface EffectInput {
  scheduleExtension: ScheduleExtension;
  timezone: Timezone;
  serviceMode?: ServiceMode;
}
const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { scheduleId } = input;

  const params = [
    {
      name: '_id',
      value: scheduleId,
    },
    {
      name: '_include',
      value: 'Schedule:actor',
    },
  ];

  const scheduleAndOwnerResults = (
    await oystehr.fhir.search<Schedule | PractitionerRole | ScheduleOwnerFhirResource>({
      resourceType: 'Schedule',
      params,
    })
  ).unbundle();

  let scheduleOwner: ScheduleOwnerFhirResource | undefined;

  const schedule = scheduleAndOwnerResults.find((res) => {
    return res.resourceType === 'Schedule' && res.id === scheduleId;
  }) as Schedule;
  if (!schedule) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }
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

  const scheduleExtension = getScheduleDetails(schedule);

  if (!scheduleExtension) {
    throw MISSING_SCHEDULE_EXTENSION_ERROR;
  }

  const timezone = getTimezone(schedule) ?? TIMEZONES[0];

  return { scheduleExtension, timezone, serviceMode };
};

function getOpeningTime(
  hoursOfOperation: LocationHoursOfOperation[],
  timezone: Timezone,
  currentDate: DateTime
): DateTime | undefined {
  const currentHoursOfOperation = getCurrentHoursOfOperation(hoursOfOperation, currentDate);
  return currentHoursOfOperation?.openingTime
    ? DateTime.fromFormat(currentHoursOfOperation?.openingTime, HOURS_OF_OPERATION_FORMAT, {
        zone: timezone,
      }).set({
        year: currentDate.year,
        month: currentDate.month,
        day: currentDate.day,
      })
    : undefined;
}

export function getClosingTime(
  hoursOfOperation: LocationHoursOfOperation[],
  timezone: Timezone,
  currentDate: DateTime
): DateTime | undefined {
  const currentHoursOfOperation = getCurrentHoursOfOperation(hoursOfOperation, currentDate);
  const formattedClosingTime = currentHoursOfOperation?.closingTime
    ? DateTime.fromFormat(currentHoursOfOperation?.closingTime, HOURS_OF_OPERATION_FORMAT, {
        zone: timezone,
      }).set({
        year: currentDate.year,
        month: currentDate.month,
        day: currentDate.day,
      })
    : undefined;
  // if time is midnight, add 1 day to closing time
  if (
    formattedClosingTime !== undefined &&
    formattedClosingTime.hour === 0 &&
    formattedClosingTime.minute === 0 &&
    formattedClosingTime.second === 0
  ) {
    return formattedClosingTime.plus({ day: 1 });
  }
  return formattedClosingTime;
}

export function getCurrentHoursOfOperation(
  hoursOfOperation: LocationHoursOfOperation[],
  currentDate: DateTime
): LocationHoursOfOperation | undefined {
  const weekdayShort = currentDate.toLocaleString({ weekday: 'short' }, { locale: 'en-US' }).toLowerCase();
  return hoursOfOperation?.find((item) => {
    return item.daysOfWeek?.[0] === weekdayShort;
  });
}

interface CheckWalkinOpenInput {
  openingTime: DateTime | undefined;
  closingTime: DateTime | undefined;
  closures: Closure[];
  timezone: Timezone;
  timeNow: DateTime;
  // this optional prop can be used to allow checking in for a walkin/ad-hoc appointment prior to the opening time
  minutesWalkinAvalilableBeforeOpening?: number;
}

function isWalkinOpen(input: CheckWalkinOpenInput): boolean {
  const { openingTime, closingTime, closures, timezone, timeNow, minutesWalkinAvalilableBeforeOpening = 0 } = input;
  const officeHasClosureOverrideToday = isClosureOverride(closures, timezone, timeNow);

  return (
    openingTime !== undefined &&
    openingTime.minus({ minute: minutesWalkinAvalilableBeforeOpening }) <= timeNow &&
    (closingTime === undefined || closingTime > timeNow) &&
    !officeHasClosureOverrideToday
  );
}

export function isClosureOverride(closures: Closure[], timezone: Timezone, currentDate: DateTime): boolean {
  const result = closures.some((closure) => {
    const { start, end } = closure;
    const closureStart = DateTime.fromFormat(start, OVERRIDE_DATE_FORMAT, { zone: timezone });
    if (closureStart.ordinal === currentDate.ordinal) {
      return true;
    } else if (end) {
      const closureEnd = DateTime.fromFormat(end, OVERRIDE_DATE_FORMAT, { zone: timezone });
      return currentDate.ordinal >= closureStart.ordinal && currentDate.ordinal <= closureEnd.ordinal;
    }
    return false;
  });
  return result;
}
