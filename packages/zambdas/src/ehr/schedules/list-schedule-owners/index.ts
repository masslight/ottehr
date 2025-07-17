import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Address, HealthcareService, Location, Practitioner, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  Closure,
  ClosureType,
  DOW,
  getScheduleExtension,
  getSecret,
  getTimezone,
  INVALID_INPUT_ERROR,
  ListScheduleOwnersParams,
  ListScheduleOwnersResponse,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  OVERRIDE_DATE_FORMAT,
  SCHEDULE_CHANGES_DATE_FORMAT,
  ScheduleListItem,
  ScheduleOwnerFhirResource,
  Secrets,
  SecretsKeys,
  TIMEZONES,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { addressStringFromAddress, getNameForOwner } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'list-schedule-owners';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const { ownerType } = validatedParameters;

    let effectInput: EffectInput;
    if (ownerType === 'HealthcareService') {
      effectInput = await complexValidation<HealthcareService>(validatedParameters, oystehr);
    } else if (ownerType === 'Location') {
      effectInput = await complexValidation<Location>(validatedParameters, oystehr);
    } else {
      effectInput = await complexValidation<Practitioner>(validatedParameters, oystehr);
    }
    const response = performEffect(effectInput);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('list-schedule-owners', error, ENVIRONMENT);
  }
});

const performEffect = (input: EffectInput): ListScheduleOwnersResponse => {
  const list = input.list
    .map((item) => {
      const { owner, schedules } = item;
      let address: Address | undefined;
      if (owner.resourceType === 'Location') {
        address = (owner as Location).address;
      } else if (owner.resourceType === 'Practitioner') {
        address = (owner as Practitioner).address?.[0];
      }
      const addressString = address ? addressStringFromAddress(address) : '';
      return {
        owner: {
          resourceType: owner.resourceType,
          id: owner.id!,
          name: getNameForOwner(owner),
          address: addressString ?? '',
        },
        schedules: schedules.map((schedule) => ({
          resourceType: schedule.resourceType,
          timezone: getTimezone(schedule) ?? TIMEZONES[0],
          id: schedule.id!,
          upcomingScheduleChanges: getItemOverrideInformation(schedule),
          todayHoursISO: getHoursOfOperationForToday(schedule),
        })),
      };
    })
    .sort((a, b) => {
      return a.owner.name.localeCompare(b.owner.name);
    });

  return { list };
};

interface BasicInput extends ListScheduleOwnersParams {
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { ownerType } = JSON.parse(input.body);

  if (!ownerType) {
    throw MISSING_REQUIRED_PARAMETERS(['ownerType']);
  }

  if (['Location', 'Practitioner', 'HealthcareService'].includes(ownerType) === false) {
    throw INVALID_INPUT_ERROR('"ownerType" must be one of: "Location", "Practitioner", "HealthcareService"');
  }

  return {
    secrets,
    ownerType,
  };
};

interface EffectInput {
  list: { owner: ScheduleOwnerFhirResource; schedules: Schedule[] }[];
}

const complexValidation = async <T extends ScheduleOwnerFhirResource>(
  input: BasicInput,
  oystehr: Oystehr
): Promise<{ list: { owner: T; schedules: Schedule[] }[] }> => {
  const { ownerType } = input;
  // splitting these into separate requests lest the _include lead to too large a response due to potentially very large json extension on
  // schedule resources
  const ownerParams = [
    {
      name: '_count',
      value: '1000',
    },
  ];
  const [scheduleRes, ownerRes] = await Promise.all([
    oystehr.fhir.search<Schedule>({
      resourceType: 'Schedule',
      params: [
        {
          name: 'actor:missing',
          value: 'false',
        },
        {
          name: 'active',
          value: 'true',
        },
      ],
    }),
    oystehr.fhir.search<T>({
      resourceType: ownerType,
      params: ownerParams,
    }),
  ]);

  const schedules = scheduleRes.unbundle() as Schedule[];
  const owners = ownerRes.unbundle() as T[];

  const scheduleOwnerMap = schedules.reduce((acc, schedule) => {
    const ownerRef = schedule.actor?.find((actor) => actor.reference)?.reference;
    const ownerId = ownerRef?.split('/')[1];
    if (ownerId) {
      const current = acc.get(ownerId) || [];
      current.push(schedule);
      acc.set(ownerId, current);
    }
    return acc;
  }, new Map<string, Schedule[]>());

  const list = owners.map((owner) => {
    const schedules = scheduleOwnerMap.get(owner.id!) ?? [];
    return {
      owner,
      schedules,
    };
  });
  return { list };
};

const getHoursOfOperationForToday = (item: Schedule): ScheduleListItem['todayHoursISO'] => {
  const tz = getTimezone(item) ?? TIMEZONES[0];
  const dayOfWeek = DateTime.now().setZone(tz).toLocaleString({ weekday: 'long' }, { locale: 'en-US' }).toLowerCase();

  const scheduleTemp = getScheduleExtension(item);
  if (!scheduleTemp) {
    return undefined;
  }
  const scheduleDays = scheduleTemp.schedule;
  const scheduleDay = scheduleDays[dayOfWeek as DOW];
  let open: number = scheduleDay.open;
  let close: number = scheduleDay.close;
  const scheduleOverrides = scheduleTemp.scheduleOverrides;
  if (scheduleTemp.scheduleOverrides) {
    for (const dateKey in scheduleOverrides) {
      if (Object.hasOwnProperty.call(scheduleOverrides, dateKey)) {
        const date = DateTime.fromFormat(dateKey, OVERRIDE_DATE_FORMAT).setZone(tz).toISODate();
        const todayDate = DateTime.now().setZone(tz).toISODate();
        if (date === todayDate) {
          open = scheduleOverrides[dateKey].open;
          close = scheduleOverrides[dateKey].close;
        }
      }
    }
  }
  if (open !== undefined && close !== undefined) {
    const openTime = DateTime.now().setZone(tz).startOf('day').plus({ hours: open }).toISO();
    const closeTime = DateTime.now().setZone(tz).startOf('day').plus({ hours: close }).toISO();
    if (!openTime || !closeTime) {
      return undefined;
    }
    return {
      open: openTime,
      close: closeTime,
    };
  }
  return undefined;
};

function getItemOverrideInformation(item: Schedule): string | undefined {
  const scheduleTemp = getScheduleExtension(item);
  if (!scheduleTemp) {
    return undefined;
  }
  if (scheduleTemp) {
    const { scheduleOverrides, closures } = scheduleTemp;
    const overrideDates = scheduleOverrides ? Object.keys(scheduleOverrides).reduce(validateOverrideDates, []) : [];
    const closureDates = closures ? closures.reduce(validateClosureDates, []) : [];
    const allDates = [...overrideDates, ...closureDates].sort((d1: string, d2: string): number => {
      // compare the single day or the first day in the period
      const startDateOne = d1.split('-')[0];
      const startDateTwo = d2.split('-')[0];
      return (
        DateTime.fromFormat(startDateOne, SCHEDULE_CHANGES_DATE_FORMAT).toSeconds() -
        DateTime.fromFormat(startDateTwo, SCHEDULE_CHANGES_DATE_FORMAT).toSeconds()
      );
    });
    const scheduleChangesSet = new Set(allDates);
    const scheduleChanges = Array.from(scheduleChangesSet);
    return scheduleChanges.length ? scheduleChanges.join(', ') : undefined;
  }
  return undefined;
}

const validateOverrideDates = (overrideDates: string[], date: string): string[] => {
  const luxonDate = DateTime.fromFormat(date, OVERRIDE_DATE_FORMAT);
  if (luxonDate.isValid && luxonDate >= DateTime.now().startOf('day')) {
    overrideDates.push(luxonDate.toFormat(SCHEDULE_CHANGES_DATE_FORMAT));
  }
  return overrideDates;
};

const validateClosureDates = (closureDates: string[], closure: Closure): string[] => {
  const today = DateTime.now().startOf('day');
  const startDate = DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT);
  if (!startDate.isValid) {
    return closureDates;
  }

  if (closure.type === ClosureType.OneDay) {
    if (startDate >= today) {
      closureDates.push(startDate.toFormat(SCHEDULE_CHANGES_DATE_FORMAT));
    }
  } else if (closure.type === ClosureType.Period) {
    const endDate = DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT);
    if (startDate >= today || endDate >= today) {
      closureDates.push(
        `${startDate.toFormat(SCHEDULE_CHANGES_DATE_FORMAT)} - ${endDate.toFormat(SCHEDULE_CHANGES_DATE_FORMAT)}`
      );
    }
  }
  return closureDates;
};
