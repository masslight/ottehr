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
  getScheduleExtension,
  GetScheduleResponse,
  getSecret,
  getTimezone,
  getWaitingMinutesAtSchedule,
  isLocationOpen,
  isLocationVirtual,
  SecretsKeys,
  SERVICE_CATEGORY_SYSTEM,
  SlotListItem,
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
  const { secrets, scheduleType, slug, selectedDate } = validatedParameters;
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
  const scheduleData = await getSchedules(oystehr, scheduleType, slug);
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

  const parseCategoryConfig = (hs: HealthcareService): { durationMinutes?: number; cadenceMinutes?: number } => {
    try {
      const raw = hs.extension?.find(
        (e) => e.url === 'https://fhir.ottehr.com/StructureDefinitions/service-category-config'
      )?.valueString;
      if (!raw) return {};
      const parsed = JSON.parse(raw) as { durationMinutes?: number; cadenceMinutes?: number };
      const out: { durationMinutes?: number; cadenceMinutes?: number } = {};
      if (typeof parsed.durationMinutes === 'number' && parsed.durationMinutes > 0) {
        out.durationMinutes = parsed.durationMinutes;
      }
      if (typeof parsed.cadenceMinutes === 'number' && parsed.cadenceMinutes > 0) {
        out.cadenceMinutes = parsed.cadenceMinutes;
      }
      return out;
    } catch {
      return {};
    }
  };

  let resolvedCoding: Coding | undefined;
  let slotLengthMinutes: number | undefined;
  let cadenceMinutes: number | undefined;

  // 1. Explicit category in the URL.
  if (serviceCategoryCode) {
    const fhirHit = fhirCategoryHits.find((hs) => hs.type?.[0]?.coding?.some((c) => c.code === serviceCategoryCode));
    if (fhirHit) {
      resolvedCoding = { system: SERVICE_CATEGORY_SYSTEM, code: serviceCategoryCode };
      const cfg = parseCategoryConfig(fhirHit);
      slotLengthMinutes = cfg.durationMinutes;
      cadenceMinutes = cfg.cadenceMinutes;
    } else {
      const configHit = BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === serviceCategoryCode);
      if (configHit) {
        resolvedCoding = { system: configHit.category.system, code: configHit.category.code };
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

  // Cadence now lives on ServiceCategoryRuntimeConfig and was resolved above
  // alongside slotLengthMinutes. The legacy GROUP_SLOT_CADENCE characteristic
  // on the group HealthcareService is no longer consulted — cadence is a
  // service-level concern, not a group-level one.

  console.log(
    'SERVICE CATEGORIES FOR SLOT GENERATION:',
    JSON.stringify({ serviceCategories, slotLengthMinutes, cadenceMinutes }, null, 2)
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
