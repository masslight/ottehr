import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { LocationHoursOfOperation, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  createOystehrClient,
  FHIR_RESOURCE_NOT_FOUND,
  getCurrentHoursOfOperation,
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
  ScheduleExtension,
  ScheduleOwnerFhirResource,
  SecretsKeys,
  ServiceMode,
  Timezone,
  TIMEZONES,
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

const performEffect = (input: EffectInput): any => {
  const { scheduleExtension, serviceMode, timezone } = input;
  // grab everything that is needed to perform the walkin availability check
  const today = DateTime.now().setZone(timezone);
  const tomorrow = today.plus({ days: 1 });
  //const tomorrowOpeningTime = getOpeningTime(scheduleExtension.schedule, timezone, tomorrow);

  return {};
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

/*

interface CheckOfficeOpenOutput {
  officeOpen: boolean;
  walkinOpen: boolean;
  prebookStillOpenForToday: boolean;
  officeHasClosureOverrideToday: boolean;
  officeHasClosureOverrideTomorrow: boolean;
}

export const useCheckOfficeOpen = (
  selectedLocation: AvailableLocationInformation | undefined
): CheckOfficeOpenOutput => {
  return useMemo(() => {
    if (!selectedLocation) {
      // console.log('no selected location, office closed');
      return {
        officeOpen: false,
        walkinOpen: false,
        officeHasClosureOverrideToday: false,
        officeHasClosureOverrideTomorrow: false,
        prebookStillOpenForToday: false,
      };
    }

    const timeNow = DateTime.now().setZone(selectedLocation.timezone);
    const tomorrowDate = timeNow.plus({ days: 1 });
    const tomorrowOpeningTime = getOpeningTime(selectedLocation, tomorrowDate);

    const officeHasClosureOverrideToday = isClosureOverride(selectedLocation, timeNow);
    const officeHasClosureOverrideTomorrow =
      isClosureOverride(selectedLocation, tomorrowDate) && tomorrowOpeningTime !== undefined;

    const todayOpeningTime = getOpeningTime(selectedLocation, timeNow);
    const todayClosingTime = getClosingTime(selectedLocation, timeNow);

    const prebookStillOpenForToday =
      todayOpeningTime !== undefined &&
      (todayClosingTime === undefined || todayClosingTime > timeNow.plus({ hours: 1 }));

    const officeOpen =
      todayOpeningTime !== undefined &&
      todayOpeningTime <= timeNow &&
      (todayClosingTime === undefined || todayClosingTime > timeNow) &&
      !officeHasClosureOverrideToday;

    const walkinOpen = isWalkinOpen(selectedLocation, timeNow);

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
    };
  }, [selectedLocation]);
};



*/

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

export function getCurrentHoursOfOperation(
  hoursOfOperation: LocationHoursOfOperation[],
  currentDate: DateTime
): LocationHoursOfOperation | undefined {
  const weekdayShort = currentDate.toLocaleString({ weekday: 'short' }, { locale: 'en-US' }).toLowerCase();
  return hoursOfOperation?.find((item) => {
    return item.daysOfWeek?.[0] === weekdayShort;
  });
}
