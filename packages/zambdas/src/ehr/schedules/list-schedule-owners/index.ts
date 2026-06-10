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
  getPractitionerRoleAllCategories,
  getScheduleExtension,
  getTimezone,
  INVALID_INPUT_ERROR,
  isServiceCategoryHealthcareService,
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

  // HealthcareService search returns both groups AND service-category catalog
  // entries (admin-registered via the Services admin UI) — both are HSes, but
  // only groups belong in this list. Service-category HSes are discriminated
  // by the SERVICE_CATEGORY_TAG meta tag, and they appear as ghost "groups"
  // with the service's name otherwise. Filter them out here. Locations and
  // Practitioners can't carry that tag, so the filter is a no-op for those.
  const filteredOwners = owners.filter(
    (o) => o.resourceType !== 'HealthcareService' || !isServiceCategoryHealthcareService(o as HealthcareService)
  );
  const list = filteredOwners.map((owner) => {
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
    // The SDK types nextCursor as `string | null`. Treat any non-string-non-empty
    // value as "no more pages" so a stray `''` from the server can't trigger
    // an infinite loop (`'' !== null` would otherwise re-enter the do/while
    // with a falsy cursor and re-fetch page 1 forever).
    let cursor: string | null = null;
    do {
      const response: Awaited<ReturnType<typeof oystehr.user.listV2>> = await oystehr.user.listV2(
        cursor ? { cursor } : {}
      );
      collected.push(...response.data);
      cursor = response.metadata.nextCursor;
    } while (cursor);
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
  // A PR without a practitioner.reference is structurally broken. We log it
  // (so the corruption is observable via Sentry / log search) and skip the
  // bad row rather than throw — throwing here would 500 the admin list
  // endpoint for every provider just because one malformed role exists,
  // blocking the only surface where the rest of the catalog can be repaired.
  const rolesByPractitionerId = new Map<string, PractitionerRole[]>();
  for (const role of roles) {
    const practitionerId = role.practitioner?.reference?.split('/')[1];
    if (!practitionerId) {
      console.error(`Skipping malformed PractitionerRole ${role.id}: no practitioner reference.`);
      continue;
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
        // A PR with the all-categories toggle on offers every service in the
        // catalog; show that as a single "All services" badge rather than
        // expanding the full list (which could be long and changes any time
        // a category is added).
        if (getPractitionerRoleAllCategories(role)) {
          categoryLabels.add('All services');
        } else {
          for (const ref of role.healthcareService ?? []) {
            const hsId = ref.reference?.split('/')[1];
            const hs = healthcareServices.find((h) => h.id === hsId);
            if (hs?.name) categoryLabels.add(hs.name);
          }
        }
        for (const s of schedules) {
          if (s.actor?.some((a) => a.reference === `PractitionerRole/${role.id}`)) {
            ownedSchedules.push(s);
          }
        }
      }
      // Emit at least one label so consumers can `.join()` unconditionally.
      // Pre-toggle, callers fell back to "All services" on empty, which is now
      // wrong (empty + toggle off = offers nothing — see PR-level
      // all-categories work).
      const categoryLabelsArray = categoryLabels.size > 0 ? [...categoryLabels] : ['No services'];
      return {
        owner: { ...practitioner, id: userIdByPractitionerId.get(practitioner.id!)! },
        schedules: ownedSchedules,
        displayName: getFullName(practitioner),
        providerSchedulesSummary: {
          locationNames: [...locationNames],
          categoryLabels: categoryLabelsArray,
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
