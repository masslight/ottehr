import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Address, HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  Closure,
  ClosureType,
  DOW,
  getAllFhirSearchPages,
  getFullName,
  getScheduleExtension,
  getTimezone,
  INVALID_INPUT_ERROR,
  ListScheduleOwnersParams,
  ListScheduleOwnersResponse,
  LOCATION_SUPPORT_PHONE_EXTENSION_URL,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  OVERRIDE_DATE_FORMAT,
  SCHEDULE_CHANGES_DATE_FORMAT,
  ScheduleListItem,
  ScheduleOwnerFhirResource,
  Secrets,
  TIMEZONES,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { addressStringFromAddress, getNameForOwner } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'list-schedule-owners';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
    // 'Practitioner' — one row per provider, summarizing across all of their PRs.
    effectInput = await complexValidationForPractitioner(validatedParameters, oystehr);
  }
  const response = performEffect(effectInput);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const performEffect = (input: EffectInput): ListScheduleOwnersResponse => {
  const list = input.list
    .map((item) => {
      const { owner, schedules, displayName, address: itemAddress, providerSchedulesSummary } = item;
      let address: Address | undefined;
      let supportPhoneNumber: string | undefined;
      if (owner.resourceType === 'Location') {
        const loc = owner as Location;
        address = loc.address;
        supportPhoneNumber = loc.extension?.find((e) => e.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL)?.valueString;
      } else if (owner.resourceType === 'Practitioner') {
        address = (owner as Practitioner).address?.[0];
      }
      const addressString = itemAddress ?? (address ? addressStringFromAddress(address) : '');
      return {
        owner: {
          resourceType: owner.resourceType,
          id: owner.id!,
          name: displayName ?? getNameForOwner(owner),
          address: addressString ?? '',
          providerSchedulesSummary,
          supportPhoneNumber,
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
  list: {
    owner: ScheduleOwnerFhirResource;
    schedules: Schedule[];
    /** Override for getNameForOwner — for Practitioner rows, getFullName(). */
    displayName?: string;
    /** Override for the address column. */
    address?: string;
    /** Populated only for Practitioner rows on the provider-schedules tab. */
    providerSchedulesSummary?: {
      locationNames: string[];
      categoryLabels: string[];
      scheduleCount: number;
    };
  }[];
}

const complexValidation = async <T extends ScheduleOwnerFhirResource>(
  input: BasicInput,
  oystehr: Oystehr
): Promise<{ list: { owner: T; schedules: Schedule[] }[] }> => {
  const { ownerType } = input;
  // splitting these into separate requests lest the _include lead to too large a response due to potentially very large json extension on
  // schedule resources.
  // Paginated: >1000 schedules would otherwise silently drop owners whose schedule lands on a later page.
  // Filter Location owners to status=active. Matches the canonical filter
  // used at PR creation (apps/ehr/src/components/schedule/PractitionerRoleList
  // uses `params: [{ name: 'status', value: 'active' }]`), so the admin
  // surface here doesn't surface schedule owners the rest of the system
  // treats as invisible. Practitioner/HealthcareService have different
  // active-flag conventions; leave them alone for now to avoid scope creep.
  const ownerParams: { name: string; value: string }[] = [];
  if (ownerType === 'Location') {
    ownerParams.push({ name: 'status', value: 'active' });
  }
  const [schedules, owners] = await Promise.all([
    getAllFhirSearchPages<Schedule>(
      {
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
      },
      oystehr
    ),
    getAllFhirSearchPages<T>(
      {
        resourceType: ownerType,
        params: ownerParams,
      },
      oystehr
    ),
  ]);

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

// One row per active provider. Shows everyone, including providers who have
// not yet had any schedule configured — their row reads as 0 schedules /
// empty locations / empty categories, and the link still routes to the
// employee detail page where setup happens.
//
// Row id is the Oystehr User.id (not Practitioner.id) so /admin/employee/:id
// and getUserDetails resolve correctly.
const complexValidationForPractitioner = async (_input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  // PR-side bundle gives us PRs + their Practitioners + Locations + categories
  // + Schedules. We then union these Practitioners with the full active
  // Practitioner set so unconfigured providers also surface.
  // Paginated: bigger orgs (many Locations × many Practitioners × multiple
  // PRs each) can blow past a single-page _count cap, silently dropping rows
  // from the admin list. Matches the pagination pattern used in the other
  // function in this file. user.list() is deprecated by the SDK; listV2
  // with cursor pagination is the supported path.
  const fetchAllUsers = async (): Promise<Awaited<ReturnType<typeof oystehr.user.listV2>>['data']> => {
    const collected: Awaited<ReturnType<typeof oystehr.user.listV2>>['data'] = [];
    let cursor: string | null = null;
    do {
      const response: Awaited<ReturnType<typeof oystehr.user.listV2>> = await oystehr.user.listV2(
        cursor ? { cursor } : {}
      );
      collected.push(...response.data);
      cursor = response.metadata.nextCursor;
    } while (cursor !== null);
    return collected;
  };
  const [prResources, allPractitioners, allUsers] = await Promise.all([
    getAllFhirSearchPages<PractitionerRole | Practitioner | Location | Schedule | HealthcareService>(
      {
        resourceType: 'PractitionerRole',
        params: [
          { name: 'active', value: 'true' },
          { name: '_include', value: 'PractitionerRole:practitioner' },
          { name: '_include', value: 'PractitionerRole:location' },
          { name: '_include', value: 'PractitionerRole:service' },
          { name: '_revinclude', value: 'Schedule:actor:PractitionerRole' },
        ],
      },
      oystehr
    ),
    getAllFhirSearchPages<Practitioner>(
      {
        resourceType: 'Practitioner',
        params: [{ name: 'active', value: 'true' }],
      },
      oystehr
    ),
    fetchAllUsers(),
  ]);

  const roles = prResources.filter((r): r is PractitionerRole => r.resourceType === 'PractitionerRole');
  const includedPractitioners = prResources.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
  const locations = prResources.filter((r): r is Location => r.resourceType === 'Location');
  const schedules = prResources.filter((r): r is Schedule => r.resourceType === 'Schedule');
  const healthcareServices = prResources.filter((r): r is HealthcareService => r.resourceType === 'HealthcareService');

  // Union of active practitioners (preserves identity by id).
  const allPractitionersById = new Map<string, Practitioner>();
  for (const p of allPractitioners) if (p.id) allPractitionersById.set(p.id, p);
  for (const p of includedPractitioners) if (p.id) allPractitionersById.set(p.id, p);

  // Map each Practitioner to its corresponding Oystehr User. Only providers
  // with a User account (i.e., login-able) appear — otherwise editing them
  // through /admin/employee/:id wouldn't work anyway.
  const userIdByPractitionerId = new Map<string, string>();
  for (const u of allUsers) {
    const profileId = u.profile?.split('/')[1];
    if (profileId) userIdByPractitionerId.set(profileId, u.id);
  }

  // Aggregate PRs per Practitioner so we can summarize across roles. Skip
  // group-membership PRs (no Location) — they aren't schedules.
  // A PR without a Practitioner reference is structurally broken (the role
  // exists to bind a Practitioner to a Location/HS context); surface that as
  // a data-integrity error rather than silently skip and yield a wrong total.
  const rolesByPractitionerId = new Map<string, PractitionerRole[]>();
  for (const role of roles) {
    const practitionerId = role.practitioner?.reference?.split('/')[1];
    if (!practitionerId) {
      // Unknown-shape error → unwrapped Error so wrapHandler's topLevelCatch
      // routes it through observability as a 500.
      throw new Error(`PractitionerRole ${role.id} has no practitioner reference.`);
    }
    if (!role.location?.[0]?.reference) continue;
    const arr = rolesByPractitionerId.get(practitionerId) ?? [];
    arr.push(role);
    rolesByPractitionerId.set(practitionerId, arr);
  }

  const list = [...allPractitionersById.values()]
    .filter((p) => p.id && userIdByPractitionerId.has(p.id))
    .map((practitioner) => {
      const practitionerRoles = rolesByPractitionerId.get(practitioner.id!) ?? [];
      const locationNames = new Set<string>();
      const categoryLabels = new Set<string>();
      const ownedSchedules: Schedule[] = [];
      for (const role of practitionerRoles) {
        const locationRef = role.location?.[0]?.reference;
        const location = locations.find((l) => `Location/${l.id}` === locationRef);
        if (location?.name) locationNames.add(location.name);
        for (const ref of role.healthcareService ?? []) {
          const hsId = ref.reference?.split('/')[1];
          const hs = healthcareServices.find((h) => h.id === hsId);
          if (hs?.name) categoryLabels.add(hs.name);
        }
        for (const s of schedules) {
          if (s.actor?.some((a) => a.reference === `PractitionerRole/${role.id}`)) {
            ownedSchedules.push(s);
          }
        }
      }
      return {
        owner: { ...practitioner, id: userIdByPractitionerId.get(practitioner.id!)! },
        schedules: ownedSchedules,
        displayName: getFullName(practitioner),
        providerSchedulesSummary: {
          locationNames: [...locationNames],
          categoryLabels: [...categoryLabels],
          // Count owned Schedule resources, not PractitionerRoles. A PR may
          // be missing its Schedule (in-flight setup, soft-deleted Schedule)
          // or — less commonly — have more than one. The UI column labeled
          // "Schedules" should reflect what was actually found.
          scheduleCount: ownedSchedules.length,
        },
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
