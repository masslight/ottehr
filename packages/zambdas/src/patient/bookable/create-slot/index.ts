import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Location, PractitionerRole, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BOOKING_CONFIG,
  CanonicalUrl,
  CreateSlotParams,
  FHIR_RESOURCE_NOT_FOUND,
  getGroupAllLocations,
  getServiceCategoryCodeSchema,
  getTimezone,
  INVALID_INPUT_ERROR,
  isBookingConfigServiceCategoryCode,
  isPractitionerRoleMemberOfGroup,
  isValidUUID,
  makeBookingOriginExtensionEntry,
  makeQuestionnaireCanonicalExtensionEntry,
  makeSlotAtLocationExtensionEntry,
  makeSlotBookedViaGroupExtensionEntry,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  Secrets,
  SERVICE_CATEGORY_SYSTEM,
  ServiceCategoryCode,
  ServiceMode,
  SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING,
  SLOT_WALKIN_APPOINTMENT_TYPE_CODING,
  SlotServiceCategory,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

const ZAMBDA_NAME = 'create-slot';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const effectInput = await complexValidation(validatedParameters, oystehr);

  const slot = await performEffect(effectInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(slot),
  };
});

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<Slot> => {
  const { slot } = input;

  return oystehr.fhir.create<Slot>(slot);
};

interface ApptLengthDef {
  length: number;
  unit: 'minutes' | 'hours';
}

interface BasicInput extends Omit<CreateSlotParams, 'lengthInMinutes' | 'lengthInHours'> {
  secrets: Secrets | null;
  apptLength: ApptLengthDef;
  questionnaireCanonical?: CanonicalUrl;
}

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const {
    scheduleId,
    startISO,
    lengthInMinutes,
    lengthInHours,
    status,
    walkin,
    serviceModality,
    postTelemedLabOnly,
    originalBookingUrl,
    serviceCategoryCode: maybeServiceCategoryCode,
    questionnaireCanonical,
    atLocationId,
    bookedViaGroupId,
  } = JSON.parse(input.body);

  // required param checks
  if (!scheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }
  if (!startISO) {
    throw MISSING_REQUIRED_PARAMETERS(['startISO']);
  }
  if (!serviceModality) {
    throw MISSING_REQUIRED_PARAMETERS(['serviceModality']);
  }

  if (isValidUUID(scheduleId) === false) {
    throw INVALID_INPUT_ERROR('"scheduleId" must be a valid UUID');
  }
  if (typeof scheduleId !== 'string') {
    throw INVALID_INPUT_ERROR('"scheduleId" must be a string');
  }
  if (typeof startISO !== 'string') {
    throw INVALID_INPUT_ERROR('"startISO" must be a string');
  }
  const startDate = DateTime.fromISO(startISO);
  if (!startDate || startDate.isValid === false) {
    throw INVALID_INPUT_ERROR('"startISO" must be a valid ISO date');
  }
  const now = DateTime.now();
  if (!walkin && startDate < now) {
    throw INVALID_INPUT_ERROR('"startISO" must be in the future');
  }

  if (status && typeof status !== 'string') {
    throw INVALID_INPUT_ERROR('"status" must be a string');
  }
  if (status && !['busy', 'free', 'busy-unavailable', 'busy-tentative', 'entered-in-error'].includes(status)) {
    throw INVALID_INPUT_ERROR(
      '"status" must be one of: "busy", "free", "busy-unavailable", "busy-tentative", "entered-in-error"'
    );
  }
  if (!lengthInMinutes && !lengthInHours) {
    throw INVALID_INPUT_ERROR(
      'Either "lengthInMinutes" or "lengthInHours" must be provided and must be greater than 0'
    );
  }
  if (lengthInMinutes && lengthInHours) {
    throw INVALID_INPUT_ERROR('Either "lengthInMinutes" or "lengthInHours" must be provided, not both');
  }
  if (lengthInMinutes && typeof lengthInMinutes !== 'number') {
    throw INVALID_INPUT_ERROR('"lengthInMinutes" must be a number');
  }
  if (lengthInHours && typeof lengthInHours !== 'number') {
    throw INVALID_INPUT_ERROR('"lengthInHours" must be a number');
  }
  if (walkin !== undefined && typeof walkin !== 'boolean') {
    throw INVALID_INPUT_ERROR('"walkin" must be a boolean');
  }
  if (postTelemedLabOnly !== undefined && typeof postTelemedLabOnly !== 'boolean') {
    throw INVALID_INPUT_ERROR('"postTelemedLabOnly" must be a boolean');
  }
  if (typeof serviceModality !== 'string') {
    throw INVALID_INPUT_ERROR('"serviceModality" must be a string');
  }
  if (!['in-person', 'virtual'].includes(serviceModality)) {
    throw INVALID_INPUT_ERROR('"serviceModality" must be one of: "in-person", "virtual"');
  }
  if (originalBookingUrl && typeof originalBookingUrl !== 'string') {
    throw INVALID_INPUT_ERROR('if included, "originalBookingUrl must be a string');
  }
  if (questionnaireCanonical) {
    if (typeof questionnaireCanonical !== 'object') {
      throw INVALID_INPUT_ERROR('"questionnaireCanonical" must be an object with url and version');
    }
    if (typeof questionnaireCanonical.url !== 'string') {
      throw INVALID_INPUT_ERROR('"questionnaireCanonical.url" must be a string');
    }
    if (typeof questionnaireCanonical.version !== 'string') {
      throw INVALID_INPUT_ERROR('"questionnaireCanonical.version" must be a string');
    }
  }
  if (atLocationId != null && typeof atLocationId !== 'string') {
    throw INVALID_INPUT_ERROR('"atLocationId" must be a string if provided');
  }
  if (bookedViaGroupId != null && typeof bookedViaGroupId !== 'string') {
    throw INVALID_INPUT_ERROR('"bookedViaGroupId" must be a string if provided');
  }
  const apptLength: ApptLengthDef = { length: 0, unit: 'minutes' };
  if (lengthInMinutes) {
    apptLength.length = lengthInMinutes;
    apptLength.unit = 'minutes';
  } else {
    apptLength.length = lengthInHours;
    apptLength.unit = 'hours';
  }

  let serviceCategoryCode: ServiceCategoryCode | undefined;

  if (maybeServiceCategoryCode) {
    const schema = getServiceCategoryCodeSchema();
    serviceCategoryCode = schema.safeParse(maybeServiceCategoryCode).data;
    if (!serviceCategoryCode) {
      throw INVALID_INPUT_ERROR('"serviceCategoryCode" must be a URL-safe slug (1-64 chars, letters/digits/hyphens)');
    }
  }

  return {
    secrets: input.secrets,
    scheduleId,
    startISO,
    status,
    apptLength,
    walkin: walkin ?? false,
    postTelemedLabOnly: postTelemedLabOnly ?? false,
    serviceModality: serviceModality as ServiceMode,
    originalBookingUrl,
    serviceCategoryCode,
    questionnaireCanonical: questionnaireCanonical as CanonicalUrl | undefined,
    atLocationId,
    bookedViaGroupId,
  };
};

interface EffectInput {
  slot: Slot;
}

const complexValidation = async (input: BasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const {
    scheduleId,
    startISO,
    apptLength,
    status,
    walkin,
    serviceModality,
    postTelemedLabOnly,
    originalBookingUrl,
    serviceCategoryCode,
    questionnaireCanonical,
    atLocationId,
    bookedViaGroupId,
  } = input;
  // query up the schedule that owns the slot
  const schedule: Schedule = await oystehr.fhir.get<Schedule>({ resourceType: 'Schedule', id: scheduleId });
  if (!schedule) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }

  // Compute the effective service category code — what actually lands on
  // Slot.serviceCategory below. Sources, in priority order:
  //   1. Caller-provided serviceCategoryCode.
  //   2. Single-BOOKING_CONFIG project default (length === 1).
  //   3. urgent-care fallback. The historical implicit category — patients
  //      who navigate to /prebook/in-person?bookingOn=loc&scheduleType=location
  //      with no serviceCategory in the URL would otherwise see a
  //      meaningless "pick a category" error dialog mid-flow. Matching
  //      create-appointment's same back-compat default; a server-side
  //      resolution keeps the user-facing flow uninterrupted.
  // Returns undefined only when the system has no BOOKING_CONFIG entries at
  // all AND no caller-provided code — a truly malformed config that has to
  // refuse rather than fabricate.
  const urgentCare = BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === 'urgent-care');
  const effectiveServiceCategoryCode: string | undefined =
    serviceCategoryCode ??
    (BOOKING_CONFIG.serviceCategories.length === 1 ? BOOKING_CONFIG.serviceCategories[0].category.code : undefined) ??
    urgentCare?.category.code;

  // PractitionerRole-owned Schedules never support BOOKING_CONFIG (compile-
  // time) service categories. BOOKING_CONFIG categories aren't backed by a
  // FHIR HealthcareService — a PR has no way to legitimately opt into one,
  // and a Slot stamped with one must live on a Location or group-
  // HealthcareService actor. Belt-and-suspenders with the same check in
  // get-schedule, so a caller that goes straight to create-slot with a known
  // PR scheduleId (e.g. /walkin/schedule/:id) still hits the invariant.
  // Fires regardless of how the BOOKING_CONFIG code was resolved (explicit,
  // single-default, urgent-care fallback) — all three are equivalent at the
  // FHIR-shape layer.
  if (effectiveServiceCategoryCode && isBookingConfigServiceCategoryCode(effectiveServiceCategoryCode)) {
    const actorRef = schedule.actor?.[0]?.reference;
    if (actorRef?.startsWith('PractitionerRole/')) {
      throw INVALID_INPUT_ERROR(
        `Service category "${effectiveServiceCategoryCode}" is not bookable against a provider-owned schedule. Book through a location or group instead.`
      );
    }
  }

  // Invariant: every persisted Slot must carry a SERVICE_CATEGORY_SYSTEM
  // coding so downstream Appointment derivation (and any other category-aware
  // code) has a category to read. Falls back exhaustively above; undefined
  // here means the system supports no compile-time categories AND the caller
  // didn't pass one — refuse rather than silently produce ambiguous data.
  // This error is engineer-facing only (the patient flow would have resolved
  // via urgent-care on any normally-configured deploy).
  if (!effectiveServiceCategoryCode) {
    throw INVALID_INPUT_ERROR(
      'A service category is required to create a slot, but none was provided and the system does not support a default category.'
    );
  }

  const timezone = getTimezone(schedule);

  // Decide whether to stamp the slot-at-location extension based on the
  // schedule's actor:
  //   - HealthcareService (group): verify the Location is a member of the
  //     group (or accept any Location when the group is flagged all-
  //     locations). Membership check moves here from create-appointment so
  //     the failure surfaces when the patient picks a time, not later at
  //     booking-create time.
  //   - PractitionerRole: verify the Location is in PR.location[].
  //   - Location actor: drop. Schedule.actor IS the Location; stamping
  //     would just duplicate state.
  //   - Practitioner actor: drop. No Location concept to attribute to.
  let shouldStampAtLocation = false;
  if (atLocationId) {
    const actorRef = schedule.actor?.[0]?.reference;
    const [actorType, actorId] = actorRef?.split('/') ?? [];
    if (!actorType || !actorId) {
      throw INVALID_INPUT_ERROR('Schedule has no resolvable actor; cannot interpret "atLocationId"');
    }
    if (actorType === 'HealthcareService' || actorType === 'PractitionerRole') {
      let atLocation: Location;
      try {
        atLocation = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: atLocationId });
      } catch {
        throw INVALID_INPUT_ERROR(`"atLocationId" did not match any Location: ${atLocationId}`);
      }
      if (actorType === 'HealthcareService') {
        const group = await oystehr.fhir.get<HealthcareService>({ resourceType: 'HealthcareService', id: actorId });
        const isAllLocations = getGroupAllLocations(group) === true;
        const groupLocationRefs = new Set(
          (group.location ?? []).map((l) => l.reference).filter((r): r is string => !!r)
        );
        const isMember = isAllLocations || groupLocationRefs.has(`Location/${atLocation.id}`);
        if (!isMember) {
          throw INVALID_INPUT_ERROR(
            `"atLocationId" resolves to a Location that is not a member of the group: ${atLocationId}`
          );
        }
      } else {
        // PractitionerRole
        const role = await oystehr.fhir.get<PractitionerRole>({ resourceType: 'PractitionerRole', id: actorId });
        const hasLocation = (role.location ?? []).some((ref) => ref.reference === `Location/${atLocation.id}`);
        if (!hasLocation) {
          throw INVALID_INPUT_ERROR(
            `"atLocationId" resolves to a Location not associated with the PractitionerRole owning this schedule: ${atLocationId}`
          );
        }
      }
      shouldStampAtLocation = true;
    }
    // Location, Practitioner: silently drop.
  }

  // Decide whether to stamp the slot-booked-via-group extension. Applies
  // when the actor is either a PR (pools-providers) or a Location whose
  // own Schedule contributes capacity to the group. Drops silently when
  // the actor IS the HS — Schedule.actor already records the group.
  //
  // This zambda is http_open, so we re-verify group membership here
  // rather than trust the caller. A naive existence check would let a
  // caller stamp any group HS onto any Slot — that ref propagates into
  // Appointment.participant (and downstream Encounter behavior), so the
  // check has to be authoritative.
  let shouldStampBookedViaGroup = false;
  if (bookedViaGroupId) {
    const actorRef = schedule.actor?.[0]?.reference ?? '';
    const [actorType, actorId] = actorRef.split('/');
    if (actorType !== 'HealthcareService') {
      // Only PR and Location actors can legitimately be group members.
      // Practitioner-actored schedules are legacy and don't participate;
      // reject explicitly rather than silently dropping the extension.
      if (actorType !== 'PractitionerRole' && actorType !== 'Location') {
        throw INVALID_INPUT_ERROR(
          `"bookedViaGroupId" requires a PractitionerRole- or Location-actored Schedule; got ${actorType || 'unknown'}`
        );
      }
      if (!actorId) {
        throw INVALID_INPUT_ERROR('Schedule actor reference is malformed');
      }
      // Pull the group HS and its Locations (for membership + inactive
      // filtering) in one search.
      const groupBundle = (
        await oystehr.fhir.search<HealthcareService | Location>({
          resourceType: 'HealthcareService',
          params: [
            { name: '_id', value: bookedViaGroupId },
            { name: '_include', value: 'HealthcareService:location' },
          ],
        })
      ).unbundle();
      const group = groupBundle.find(
        (r): r is HealthcareService => r.resourceType === 'HealthcareService' && r.id === bookedViaGroupId
      );
      if (!group) {
        throw INVALID_INPUT_ERROR(`"bookedViaGroupId" did not match any HealthcareService: ${bookedViaGroupId}`);
      }
      const inactiveLocationIds = new Set<string>();
      for (const res of groupBundle) {
        if (res.resourceType === 'Location' && res.id && (res as Location).status === 'inactive') {
          inactiveLocationIds.add(res.id);
        }
      }
      if (actorType === 'Location') {
        // Location-actored: the actor must itself be one of the group's
        // member Locations, and it must be active. (Inactive Locations
        // stop contributing to group slot generation; the same rule
        // applies to direct Location-actor membership.)
        if (inactiveLocationIds.has(actorId)) {
          throw INVALID_INPUT_ERROR(
            `Schedule's actor Location is inactive and cannot contribute to the group: ${bookedViaGroupId}`
          );
        }
        const groupLocationRefs = new Set((group.location ?? []).map((l) => l.reference).filter(Boolean) as string[]);
        if (!groupLocationRefs.has(`Location/${actorId}`)) {
          throw INVALID_INPUT_ERROR(`Schedule's actor Location is not a member of the group: ${bookedViaGroupId}`);
        }
      } else {
        // PR-actored: defer to the membership walker so back-ref, location-
        // overlap, and all-locations widening all resolve consistently with
        // how slot-vending decides membership.
        let actorRole: PractitionerRole | undefined;
        try {
          actorRole = await oystehr.fhir.get<PractitionerRole>({
            resourceType: 'PractitionerRole',
            id: actorId,
          });
        } catch {
          throw INVALID_INPUT_ERROR(`Schedule actor PractitionerRole not found: ${actorId}`);
        }
        const allLocationsFlag = getGroupAllLocations(group) === true;
        if (!isPractitionerRoleMemberOfGroup({ role: actorRole, group, allLocationsFlag, inactiveLocationIds })) {
          throw INVALID_INPUT_ERROR(
            `Schedule's actor PractitionerRole is not a member of the group: ${bookedViaGroupId}`
          );
        }
      }
      shouldStampBookedViaGroup = true;
    }
    // HS actor: silently drop — Schedule.actor already records the group.
  }

  // setZone: true preserves the timezone from the input ISO string instead of converting to system timezone
  // This prevents DST offset issues when the system timezone differs from the intended timezone
  const startTime = DateTime.fromISO(startISO, { setZone: true });
  const endTime = startTime.plus({ [apptLength.unit]: apptLength.length });

  const start = startTime.setZone(timezone).toISO();
  const end = endTime.setZone(timezone).toISO();

  if (!start || !end) {
    throw INVALID_INPUT_ERROR('Unable to create start and end times');
  }

  // Stamp the resolved category onto Slot.serviceCategory. BOOKING_CONFIG hit
  // → spread the full compiled-in coding (carries display). Otherwise treat
  // as FHIR-backed; readers who need a human-readable name can resolve from
  // the HealthcareService catalog. effectiveServiceCategoryCode is guaranteed
  // truthy past the throw above.
  const serviceCategory =
    serviceModality === ServiceMode['in-person']
      ? [SlotServiceCategory.inPersonServiceMode]
      : [SlotServiceCategory.virtualServiceMode];
  const effectiveCodeConfig = BOOKING_CONFIG.serviceCategories.find(
    (sc) => sc.category.code === effectiveServiceCategoryCode
  );
  if (effectiveCodeConfig) {
    serviceCategory.push({ coding: [{ ...effectiveCodeConfig.category }] });
  } else {
    serviceCategory.push({ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: effectiveServiceCategoryCode }] });
  }

  const extension: Slot['extension'] = [];
  if (originalBookingUrl) {
    extension.push(makeBookingOriginExtensionEntry(originalBookingUrl));
  }
  if (questionnaireCanonical) {
    extension.push(makeQuestionnaireCanonicalExtensionEntry(questionnaireCanonical));
  }
  if (shouldStampAtLocation && atLocationId) {
    extension.push(makeSlotAtLocationExtensionEntry(atLocationId));
  }
  if (shouldStampBookedViaGroup && bookedViaGroupId) {
    extension.push(makeSlotBookedViaGroupExtensionEntry(bookedViaGroupId));
  }
  const slot: Slot = {
    resourceType: 'Slot',
    status: status ?? 'busy',
    start,
    end,
    serviceCategory,
    schedule: {
      reference: `Schedule/${schedule.id}`,
    },
    ...(extension.length > 0 && { extension }),
  };
  if (walkin) {
    slot.appointmentType = { ...SLOT_WALKIN_APPOINTMENT_TYPE_CODING };
  } else if (postTelemedLabOnly) {
    slot.appointmentType = { ...SLOT_POST_TELEMED_APPOINTMENT_TYPE_CODING };
  }
  // optional: check if the schedule owner permits the provided service modality
  // we do this instead at appointment creation time
  return { slot };
};
