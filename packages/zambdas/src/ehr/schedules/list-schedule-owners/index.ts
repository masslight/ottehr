import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Address, HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getPractitionerRoleAllCategories, isServiceCategoryHealthcareService } from 'utils/lib/fhir/healthcareService';
import { getFullName } from 'utils/lib/fhir/patient';
import { Secrets } from 'utils/lib/secrets';
import {
  ListScheduleOwnersParams,
  ListScheduleOwnersResponse,
  ScheduleListItem,
  ScheduleOwnerFhirResource,
} from 'utils/lib/types/api/schedules';
import { Closure, ClosureType, OVERRIDE_DATE_FORMAT } from 'utils/lib/types/common';
import { TIMEZONES } from 'utils/lib/types/constants';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { DOW, getScheduleExtension, getTimezone, SCHEDULE_CHANGES_DATE_FORMAT } from 'utils/lib/utils/scheduleUtils';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { addressStringFromAddress, getNameForOwner } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'list-schedule-owners';

// Logs how long an async operation takes. Used to pinpoint which fetch
// dominates the endpoint's latency in production (FHIR include search vs.
// user pagination) so we can keep an eye on timeout regressions.
const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`${label} took ${Date.now() - start}ms`);
  }
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
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
      let active: boolean | undefined;
      if (owner.resourceType === 'Location') {
        const loc = owner as Location;
        address = loc.address;
        supportPhoneNumber = loc.extension?.find((e) => e.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL)?.valueString;
        active = loc.status === 'active';
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
          active,
        },
        schedules: schedules.map((entry) => {
          const schedule = entry.schedule;
          return {
            resourceType: schedule.resourceType,
            timezone: getTimezone(schedule) ?? TIMEZONES[0],
            id: schedule.id!,
            upcomingScheduleChanges: getItemOverrideInformation(schedule),
            todayHoursISO: getHoursOfOperationForToday(schedule),
            locationId: entry.locationId,
            locationName: entry.locationName,
            categoryLabels: entry.categoryLabels,
            // A PR schedule is live only if both the Schedule and its role are active.
            active: schedule.active !== false && entry.roleActive !== false,
          };
        }),
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

/**
 * A schedule plus the per-PR context the combined Schedules list needs to render
 * a "Provider · Location" pair. location fields, categoryLabels, and roleActive
 * are populated only for provider (PractitionerRole) schedules; Location/Group
 * schedules carry just the schedule.
 */
interface ScheduleEntry {
  schedule: Schedule;
  locationId?: string;
  locationName?: string;
  categoryLabels?: string[];
  /** Owning PractitionerRole.active — combined with Schedule.active for liveness. */
  roleActive?: boolean;
}

interface EffectInput {
  list: {
    owner: ScheduleOwnerFhirResource;
    schedules: ScheduleEntry[];
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
): Promise<{ list: { owner: T; schedules: ScheduleEntry[] }[] }> => {
  const { ownerType } = input;
  // One owner-side search with a scoped _revinclude. Returns every owner —
  // Locations and Groups appear even when they own no schedule, because the
  // create-schedule / create-group flows reuse this endpoint as an owner
  // picker — plus ONLY the Schedules actored by this owner type. Owners are
  // returned regardless of status (an inactive Location stays visible with an
  // "Active" column and can be reactivated); the owner DTO carries `active`.
  //
  // This previously fetched from the Schedule side — every active schedule with
  // any actor — and discarded the non-matching ones. That pulled every
  // PractitionerRole- and Group-actored schedule too (the bulk of the project's
  // schedules, each carrying a large JSON hours/overrides extension), which
  // dominated the endpoint's latency. Scoping to `Schedule:actor:<ownerType>`
  // fetches a strict subset. Paginated so an owner whose schedule lands on a
  // later page isn't dropped.
  const resources = await timed(`[${ownerType}] owner search (+ scoped schedules)`, () =>
    getAllFhirSearchPages<ScheduleOwnerFhirResource | Schedule>(
      {
        resourceType: ownerType,
        params: [{ name: '_revinclude', value: `Schedule:actor:${ownerType}` }],
      },
      oystehr
    )
  );
  const owners = resources.filter((r) => r.resourceType === ownerType) as T[];
  const schedules = resources.filter((r): r is Schedule => r.resourceType === 'Schedule');
  console.log(`[list-schedule-owners][${ownerType}] fetched ${schedules.length} schedules, ${owners.length} owners`);

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
    const schedules = (scheduleOwnerMap.get(owner.id!) ?? []).map((schedule) => ({ schedule }));
    return {
      owner,
      schedules,
    };
  });
  return { list };
};

// One entry per provider that owns at least one schedule; the combined Schedules
// list expands each into per-PractitionerRole "Provider · Location" child rows.
// Providers with no schedule are omitted here — the list is per-schedule, and
// un-scheduled providers are set up from the Employees page
// (PractitionerRoleList → "Set up scheduling").
//
// Row id is the Oystehr User.id (not Practitioner.id) so /admin/employee/:id
// and getUserDetails resolve correctly.
const complexValidationForPractitioner = async (_input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  // The combined Schedules list only shows providers that own at least one
  // schedule, and every such provider is reachable through a PractitionerRole.
  // So a single PR-side bundle — PRs + their Practitioners + Locations +
  // categories + Schedules — is all we need. We deliberately do NOT fetch the
  // full Practitioner set or the project's Users here:
  //   - The old "union with all active Practitioners" existed to surface
  //     un-scheduled providers, which this list no longer shows.
  //   - Resolving each Practitioner to its Oystehr User (to key rows by User
  //     id) meant paging the Provider-role users — the single slowest call in
  //     the endpoint. Rows are keyed by Practitioner id instead; the frontend
  //     resolves the User id lazily, only for the "Manage provider" link.
  // Paginated: bigger orgs (many Locations × many Practitioners × multiple
  // PRs each) can blow past a single-page _count cap, silently dropping rows.
  const prResources = await getAllFhirSearchPages<
    PractitionerRole | Practitioner | Location | Schedule | HealthcareService
  >(
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
  );

  const roles = prResources.filter((r): r is PractitionerRole => r.resourceType === 'PractitionerRole');
  const includedPractitioners = prResources.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
  const locations = prResources.filter((r): r is Location => r.resourceType === 'Location');
  const schedules = prResources.filter((r): r is Schedule => r.resourceType === 'Schedule');
  const healthcareServices = prResources.filter((r): r is HealthcareService => r.resourceType === 'HealthcareService');

  const practitionersById = new Map<string, Practitioner>();
  for (const p of includedPractitioners) if (p.id) practitionersById.set(p.id, p);

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

  const list = [...practitionersById.values()]
    .map((practitioner) => {
      const practitionerRoles = rolesByPractitionerId.get(practitioner.id!) ?? [];
      const locationNames = new Set<string>();
      const categoryLabelsAgg = new Set<string>();
      // One entry per (role → schedule) so the list can render a per-location
      // child row for each of the provider's schedules.
      const scheduleEntries: ScheduleEntry[] = [];
      for (const role of practitionerRoles) {
        const locationRef = role.location?.[0]?.reference;
        const location = locations.find((l) => `Location/${l.id}` === locationRef);
        const locationId = location?.id ?? locationRef?.split('/')[1];
        const locationName = location?.name;
        if (locationName) locationNames.add(locationName);
        // A PR with the all-categories toggle on offers every service in the
        // catalog; show that as a single "All services" badge rather than
        // expanding the full list (which could be long and changes any time
        // a category is added). `healthcareService[]` carries both category
        // refs AND group-membership refs, so the category-tag filter keeps a
        // group's name from surfacing as a phantom service.
        let categoryLabels: string[];
        if (getPractitionerRoleAllCategories(role)) {
          categoryLabels = ['All services'];
        } else {
          const labels = new Set<string>();
          for (const ref of role.healthcareService ?? []) {
            const hsId = ref.reference?.split('/')[1];
            const hs = healthcareServices.find((h) => h.id === hsId);
            if (hs && isServiceCategoryHealthcareService(hs) && hs.name) labels.add(hs.name);
          }
          // Emit at least one label so consumers can `.join()` unconditionally
          // (empty + toggle off = offers nothing, not "all services").
          categoryLabels = labels.size > 0 ? [...labels] : ['No services'];
        }
        categoryLabels.forEach((c) => categoryLabelsAgg.add(c));
        const roleActive = role.active !== false;
        for (const s of schedules) {
          if (s.actor?.some((a) => a.reference === `PractitionerRole/${role.id}`)) {
            scheduleEntries.push({ schedule: s, locationId, locationName, categoryLabels, roleActive });
          }
        }
      }
      const categoryLabelsArray = categoryLabelsAgg.size > 0 ? [...categoryLabelsAgg] : ['No services'];
      return {
        // Rows are keyed by Practitioner id. The frontend resolves the owning
        // User id lazily (only the "Manage provider" link needs it), which
        // keeps the project-wide user scan off this list's critical path.
        owner: practitioner,
        schedules: scheduleEntries,
        displayName: getFullName(practitioner),
        providerSchedulesSummary: {
          locationNames: [...locationNames],
          categoryLabels: categoryLabelsArray,
          scheduleCount: scheduleEntries.length,
        },
      };
    })
    // Providers with no schedule at all are omitted — the combined list is
    // per-schedule; un-scheduled providers are set up from the Employees page.
    .filter((item) => item.schedules.length > 0);
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
