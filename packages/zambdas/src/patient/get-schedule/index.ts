import { APIGatewayProxyResult } from 'aws-lambda';
import { Coding, HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AvailableLocationInformation,
  BOOKING_CONFIG,
  FHIR_RESOURCE_NOT_FOUND,
  fhirTypeForScheduleType,
  getAvailableSlotsForSchedules,
  getFullName,
  getLocationInformation,
  getOpeningTime,
  getPractitionerRoleAllCategories,
  getScheduleExtension,
  GetScheduleResponse,
  getSecret,
  getServiceCategoryCadenceMinutes,
  getServiceCategoryDurationMinutes,
  getSlugForBookableResource,
  getTimezone,
  getWaitingMinutesAtSchedule,
  isLocationOpen,
  isLocationVirtual,
  PickableLocation,
  SecretsKeys,
  SERVICE_CATEGORY_SYSTEM,
  SlotListItem,
  SLUG_SYSTEM,
  Timezone,
} from 'utils';
import { createOystehrClient, getAuth0Token, getSchedules, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler('get-schedule', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log('this should get logged out if the zambda has been deployed');
  console.log(`Input: ${JSON.stringify(input)}`);

  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { secrets, scheduleType, slug, selectedDate, atLocationSlug } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(secrets);
  } else {
    console.log('already have token', oystehrToken);
  }

  const oystehr = createOystehrClient(oystehrToken, secrets);
  if (!oystehr) {
    throw new Error('error initializing fhir client');
  }

  const telemedAvailable: SlotListItem[] = [];
  const availableSlots: SlotListItem[] = [];

  console.time('get-schedule-from-slug');
  const scheduleData = await getSchedules(oystehr, scheduleType, { slug });
  const { scheduleList, metadata, rootScheduleOwner: scheduleOwner } = scheduleData;
  console.timeEnd('get-schedule-from-slug');
  console.log('groupItems retrieved from getScheduleUtil:', JSON.stringify(scheduleList, null, 2));
  //console.log('owner retrieved from getScheduleUtil:', JSON.stringify(scheduleOwner, null, 2));
  console.log('scheduleMetaData', JSON.stringify(metadata, null, 2));

  const { serviceCategoryCode } = validatedParameters;

  // Resolve the effective service category for this booking. Sources, in order:
  //   1. URL serviceCategoryCode (group bookings, explicitly-scoped PR links).
  //   2. PR-direct bookings where the PR offers exactly one category — that
  //      category is unambiguously what's being booked, so use it.
  //   3. Otherwise undefined; slot generator uses defaults.
  //
  // Same lookup feeds Slot.serviceCategory stamping, slot duration, AND cadence.
  // We fetch the category-tagged HealthcareServices once and use the result for
  // every downstream lookup that needs them.
  const fhirCategoryHits = (
    await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [
        { name: '_tag', value: 'booking-service-category' },
        { name: 'active', value: 'true' },
      ],
    })
  ).unbundle();

  const parseCategoryConfig = (hs: HealthcareService): { durationMinutes?: number; cadenceMinutes?: number } => ({
    durationMinutes: getServiceCategoryDurationMinutes(hs),
    cadenceMinutes: getServiceCategoryCadenceMinutes(hs),
  });

  let resolvedCoding: Coding | undefined;
  let slotLengthMinutes: number | undefined;
  let cadenceMinutes: number | undefined;

  // 1. Explicit category in the URL.
  // Resolution order is BOOKING_CONFIG-first → FHIR-fallback. BOOKING_CONFIG is
  // the compiled-in source of truth for production-deployed categories
  // (urgent-care, workers-comp, etc.); a FHIR entry with the same code is
  // intentionally ignored so an admin who creates a colliding FHIR row can't
  // silently change the slot-generation behavior of an existing production
  // booking URL. The FHIR catalog is consulted only for codes that are NOT
  // already in BOOKING_CONFIG (i.e., genuinely new admin-added categories).
  if (serviceCategoryCode) {
    const configHit = BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === serviceCategoryCode);
    if (configHit) {
      resolvedCoding = { system: configHit.category.system, code: configHit.category.code };
      // BOOKING_CONFIG entries don't carry cadence — slot generation falls
      // through to per-Schedule slot length, the pre-branch behavior.
    } else {
      const fhirHit = fhirCategoryHits.find((hs) => hs.type?.[0]?.coding?.some((c) => c.code === serviceCategoryCode));
      if (fhirHit) {
        resolvedCoding = { system: SERVICE_CATEGORY_SYSTEM, code: serviceCategoryCode };
        const cfg = parseCategoryConfig(fhirHit);
        slotLengthMinutes = cfg.durationMinutes;
        cadenceMinutes = cfg.cadenceMinutes;
      }
    }
  }

  // 2. PR-direct booking with a single offered category — infer it.
  if (!resolvedCoding && scheduleOwner.resourceType === 'PractitionerRole') {
    const roleServices = (scheduleOwner as any).healthcareService ?? [];
    if (roleServices.length === 1) {
      const onlyId = (roleServices[0]?.reference as string | undefined)?.split('/')[1];
      const inferredHit = fhirCategoryHits.find((hs) => hs.id === onlyId);
      const inferredCode = inferredHit?.type?.[0]?.coding?.find((c) => c.code)?.code;
      if (inferredHit && inferredCode) {
        resolvedCoding = { system: SERVICE_CATEGORY_SYSTEM, code: inferredCode };
        const cfg = parseCategoryConfig(inferredHit);
        slotLengthMinutes = cfg.durationMinutes;
        cadenceMinutes = cfg.cadenceMinutes;
      }
    }
  }

  const serviceCategories: Coding[] | undefined = resolvedCoding ? [resolvedCoding] : undefined;

  // For group bookings, the group's type[] is the authoritative allow-list of
  // categories patients can book through it. Reject URL category codes that
  // aren't in the list — otherwise a multi-skill member's other categories
  // (e.g. an aesthetics provider in a Massage group) would leak through.
  if (serviceCategoryCode && scheduleOwner.resourceType === 'HealthcareService') {
    const groupSupportedCodes = (scheduleOwner as HealthcareService).type
      ?.flatMap((t) => t.coding || [])
      .map((c) => c.code)
      .filter((c): c is string => !!c);
    if (groupSupportedCodes && groupSupportedCodes.length > 0 && !groupSupportedCodes.includes(serviceCategoryCode)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `This group does not offer "${serviceCategoryCode}".`,
          code: 'CATEGORY_NOT_SUPPORTED_BY_GROUP',
        }),
      };
    }
  }

  // Filter PractitionerRole-owned schedules by healthcareService[]. When a
  // category is requested, drop any schedule whose PractitionerRole owner
  // doesn't list the category-tagged HealthcareService (matched by code on
  // the role's healthcareService references resolved through fhirMatches).
  // Schedules owned by Location / Practitioner / HealthcareService pass through
  // unchanged — we only use the role's service list to narrow the pool.
  if (serviceCategoryCode) {
    const categoryHealthcareServiceIds = new Set<string>();
    // Resolve the category-tagged HealthcareService(s) to their ids so we can
    // match against role.healthcareService[].reference.
    const categoryHits = (
      await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [
          { name: '_tag', value: 'booking-service-category' },
          { name: 'active', value: 'true' },
        ],
      })
    ).unbundle();
    for (const hs of categoryHits) {
      if (hs.type?.[0]?.coding?.some((c) => c.code === serviceCategoryCode) && hs.id) {
        categoryHealthcareServiceIds.add(hs.id);
      }
    }

    const filtered = scheduleList.filter((entry) => {
      if (entry.owner.resourceType !== 'PractitionerRole') return true;
      // PR with the all-categories toggle on is qualified for any service the
      // resolver asks about — no per-category opt-in needed.
      if (getPractitionerRoleAllCategories(entry.owner as PractitionerRole)) return true;
      const roleServices = (entry.owner as any).healthcareService || [];
      return roleServices.some((ref: { reference?: string }) => {
        const id = ref.reference?.split('/')[1];
        return id && categoryHealthcareServiceIds.has(id);
      });
    });
    // Mutate in place so the rest of the handler uses the filtered list.
    scheduleList.length = 0;
    scheduleList.push(...filtered);
  }

  // Resolve atLocationSlug → Location id, then narrow scheduleList to
  // entries that actually operate at that Location. If atLocationSlug isn't
  // provided but the remaining scheduleList spans more than one Location,
  // error out — the caller must disambiguate so vended slots carry a
  // definite Location attribution. The Location chosen here is the one
  // stamped on every vended Slot via the slot-at-location extension.
  let atLocationId: string | undefined;
  if (atLocationSlug) {
    const candidates = (
      await oystehr.fhir.search<Location>({
        resourceType: 'Location',
        params: [{ name: 'identifier', value: `${SLUG_SYSTEM}|${atLocationSlug}` }],
      })
    ).unbundle();
    const candidate = candidates[0];
    if (!candidate?.id) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `"atLocationSlug" did not match any Location: ${atLocationSlug}`,
          code: 'AT_LOCATION_NOT_FOUND',
        }),
      };
    }
    atLocationId = candidate.id;
  }

  const qualifyingLocationIds = new Set<string>();
  for (const entry of scheduleList) {
    if (entry.owner.resourceType === 'Location' && entry.owner.id) {
      qualifyingLocationIds.add(entry.owner.id);
    } else if (entry.owner.resourceType === 'PractitionerRole') {
      for (const ref of (entry.owner as PractitionerRole).location ?? []) {
        const id = ref.reference?.split('/')[1];
        if (id) qualifyingLocationIds.add(id);
      }
    }
  }

  if (atLocationId) {
    if (!qualifyingLocationIds.has(atLocationId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'No bookable schedules at the specified location.',
          code: 'NO_SCHEDULES_AT_LOCATION',
        }),
      };
    }
    const narrowed = scheduleList.filter((entry) => {
      if (entry.owner.resourceType === 'Location') return entry.owner.id === atLocationId;
      if (entry.owner.resourceType === 'PractitionerRole') {
        return ((entry.owner as PractitionerRole).location ?? []).some(
          (ref) => ref.reference?.split('/')[1] === atLocationId
        );
      }
      // Practitioner / HealthcareService owners pass through (rare in the
      // current model). They have no Location of their own to filter on.
      return true;
    });
    scheduleList.length = 0;
    scheduleList.push(...narrowed);
  } else if (qualifyingLocationIds.size > 1) {
    // Multi-Location owner with no atLocationSlug provided. Rather than
    // erroring, return the qualifying Locations so the front-end can
    // render a picker. The caller re-invokes with atLocationSlug set
    // once the patient chooses. Slot lists are empty in this response —
    // the presence of pickableLocations signals "no slots yet, pick a
    // Location first."
    const ids = Array.from(qualifyingLocationIds);
    const locationResources = (
      await oystehr.fhir.search<Location>({
        resourceType: 'Location',
        params: [{ name: '_id', value: ids.join(',') }],
      })
    ).unbundle();
    const pickableLocations: PickableLocation[] = locationResources
      .map((loc) => {
        if (!loc.id) return undefined;
        const pickableSlug = getSlugForBookableResource(loc);
        if (!pickableSlug) return undefined;
        return { id: loc.id, slug: pickableSlug, name: loc.name ?? loc.id };
      })
      .filter((x): x is PickableLocation => !!x)
      .sort((a, b) => a.name.localeCompare(b.name));
    const pickerResponse: GetScheduleResponse = {
      message: 'Multiple Locations qualify; pick one to see slots.',
      available: [],
      telemedAvailable: [],
      waitingMinutes: 0,
      displayTomorrowSlotsAtHour: 0,
      pickableLocations,
    };
    return {
      statusCode: 200,
      body: JSON.stringify(pickerResponse),
    };
  }

  // Effective Location stamp for vended Slots: explicit input, or the
  // single qualifying Location if there's only one. Undefined for the
  // (degenerate) zero-qualifying-Locations case — vended slots get no
  // stamp and create-appointment falls back to its actor walk.
  const effectiveAtLocationId =
    atLocationId ?? (qualifyingLocationIds.size === 1 ? Array.from(qualifyingLocationIds)[0] : undefined);

  // Stamp the originating group on each vended Slot when this is a group
  // booking. The scheduleOwner is the group HS itself (slug → owner via
  // getSchedules). makeSlotListItems will skip stamping for entries where
  // the Schedule's actor IS the group (no-state-duplication rule) — only
  // PR-actored member schedules (the pools-providers case) get the stamp.
  const bookedViaGroupId =
    scheduleType === 'group' && scheduleOwner.resourceType === 'HealthcareService' ? scheduleOwner.id : undefined;

  // Cadence is a service-level property — resolved above from
  // ServiceCategoryRuntimeConfig alongside slotLengthMinutes.

  console.log(
    'SERVICE CATEGORIES FOR SLOT GENERATION:',
    JSON.stringify(
      { serviceCategories, slotLengthMinutes, cadenceMinutes, effectiveAtLocationId, bookedViaGroupId },
      null,
      2
    )
  );

  console.time('synchronous_data_processing');
  const { telemedAvailable: tmSlots, availableSlots: regularSlots } = await getAvailableSlotsForSchedules(
    {
      now: selectedDate ? DateTime.fromISO(selectedDate).startOf('day') : DateTime.now(),
      scheduleList,
      numDays: selectedDate ? 1 : undefined,
      selectedDate,
      serviceCategories,
      slotLengthMinutes,
      cadenceMinutes,
      atLocationId: effectiveAtLocationId,
      bookedViaGroupId,
    },
    oystehr
  );
  if (scheduleOwner.resourceType === 'Location' && !isLocationVirtual(scheduleOwner as Location)) {
    telemedAvailable.push(...tmSlots);
  }
  availableSlots.push(...regularSlots);
  console.timeEnd('synchronous_data_processing');

  if (!scheduleOwner) {
    throw FHIR_RESOURCE_NOT_FOUND(fhirTypeForScheduleType(scheduleType));
  }

  const now = DateTime.now();

  // todo: this should live on a fhir resource rather than being a global secret
  const DISPLAY_TOMORROW_SLOTS_AT_HOUR = parseInt(
    getSecret(SecretsKeys.IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR, secrets)
  );

  /*
  todo when Zap supports the near param
  const nearbyLocations: Location = [];

  const latitude = location.position?.latitude;
  const longitude = location.position?.longitude;
  if (latitude && longitude && location.id) {
    console.log('searching for locations near', latitude, longitude);
    const nearbyLocationSearchResults: Location[] = await oystehr.searchResources({
      resourceType: 'Location',
      searchParams: [
        { name: 'near', value: `${latitude}|${longitude}|20.0|mi_us` },
        // { name: '_id:not-in', value: location.id },
      ],
    });
    console.log('nearbyLocationSearchResults', nearbyLocationSearchResults.length);
  }*/

  console.log('organizing location information for response');

  const scheduleMatch = scheduleList.find((scheduleAndOwner) => {
    const { owner } = scheduleAndOwner;
    return owner && `${owner.resourceType}/${owner.id}` === `${scheduleOwner.resourceType}/${scheduleOwner.id}`;
  })?.schedule;

  const locationInformationWithClosures: AvailableLocationInformation = getLocationInformation(
    scheduleOwner,
    scheduleMatch
  );

  // PR-actored schedules don't carry a friendly name — getLocationInformation
  // returns "Role <uuid>" as a placeholder. Compose "<practitioner-name> at
  // <location-name>" by fetching the referenced resources, so the booking page
  // header reads naturally to the patient.
  if (scheduleOwner.resourceType === 'PractitionerRole') {
    const role = scheduleOwner as PractitionerRole;
    const practitionerId = role.practitioner?.reference?.split('/')[1];
    const locationId = role.location?.[0]?.reference?.split('/')[1];
    const [practitioner, prLocation] = await Promise.all([
      practitionerId
        ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId }).catch(() => undefined)
        : Promise.resolve(undefined),
      locationId
        ? oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    const practitionerName = practitioner ? getFullName(practitioner) : undefined;
    const locationName = prLocation?.name;
    const composed =
      practitionerName && locationName ? `${practitionerName} at ${locationName}` : practitionerName ?? locationName;
    if (composed) {
      locationInformationWithClosures.name = composed;
    }
  }

  console.log('getting wait time based on longest waiting patient at location');
  console.time('get_waiting_minutes');
  const waitingMinutes = await getWaitingMinutesAtSchedule(oystehr, now, scheduleOwner);
  console.timeEnd('get_waiting_minutes');

  let timezone: Timezone | undefined;
  if (scheduleList.length === 1) {
    const schedule = scheduleList[0].schedule;
    if (schedule) {
      timezone = getTimezone(schedule);
    }
  }

  const response: GetScheduleResponse = {
    message: 'Successfully retrieved all available slot times',
    available: availableSlots,
    telemedAvailable,
    location: locationInformationWithClosures,
    displayTomorrowSlotsAtHour: DISPLAY_TOMORROW_SLOTS_AT_HOUR,
    waitingMinutes,
    timezone,
  };

  console.log('response to return: ', response);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export function getNextOpeningDateTime(now: DateTime, schedule: Schedule): string | undefined {
  const NUM_DAYS_TO_CHECK = 30;
  let day = 0;
  let nextOpeningTime: DateTime | undefined;
  const scheduleExtension = getScheduleExtension(schedule);
  if (!scheduleExtension) {
    return undefined;
  }
  const timezone = getTimezone(schedule);
  while (day < NUM_DAYS_TO_CHECK && nextOpeningTime === undefined) {
    const nextOpeningDate = now.plus({ day });
    if (isLocationOpen(scheduleExtension, timezone, nextOpeningDate)) {
      const maybeNextOpeningTime = getOpeningTime(scheduleExtension, timezone, nextOpeningDate);
      if (maybeNextOpeningTime && maybeNextOpeningTime > now) {
        nextOpeningTime = maybeNextOpeningTime;
      }
    }
    day++;
  }
  return nextOpeningTime?.setZone('utc').toFormat('HH:mm MM-dd-yyyy z');
}
