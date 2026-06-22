import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Address, ContactPoint, Extension, Location, Schedule } from 'fhir/r4b';
import {
  APIErrorCode,
  Closure,
  DailySchedule,
  getScheduleExtension,
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  MISSING_SCHEDULE_EXTENSION_ERROR,
  PUBLIC_EXTENSION_BASE_URL,
  RoleType,
  ROOM_EXTENSION_URL,
  SCHEDULE_EXTENSION_URL,
  SCHEDULE_NOT_FOUND_ERROR,
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  ScheduleExtension,
  ScheduleOverrides,
  ScheduleOwnerFhirResource,
  SLUG_SYSTEM,
  TelecomUpdate,
  TIMEZONE_EXTENSION_URL,
  userMe,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { UpdateScheduleBasicInput, validateUpdateScheduleParameters } from '../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'update-schedule';

const PAYMENT_FIELD_ROLES: ReadonlyArray<string> = [RoleType.CustomerSupport];

const callerCanEditPaymentFields = async (
  authorizationHeader: string | undefined,
  secrets: ZambdaInput['secrets']
): Promise<boolean> => {
  if (!authorizationHeader) return false;
  const token = authorizationHeader.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const caller = await userMe(token, secrets);
    const callerRoles = (caller.roles ?? []).map((role) => role.name);
    return callerRoles.some((role) => PAYMENT_FIELD_ROLES.includes(role));
  } catch (err) {
    console.error('Failed to resolve caller from Authorization header:', err);
    return false;
  }
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateUpdateScheduleParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;

  // Authorization gate for payment-related fields: only CustomerSupport may set these.
  // (Caller's UI may also hide them for Administrators, but the backend is the source of truth.)
  if (validatedParameters.stripeAccountId !== undefined || validatedParameters.advapacsLocationId !== undefined) {
    const allowed = await callerCanEditPaymentFields(input.headers?.Authorization, secrets);
    if (!allowed) {
      throw {
        code: APIErrorCode.NOT_AUTHORIZED,
        message: 'Only Customer Support may modify stripeAccountId or advapacsLocationId.',
      };
    }
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);
  const effectInput = await complexValidation(validatedParameters, oystehr);

  const updatedSchedule = await performEffect(effectInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(updatedSchedule),
  };
});

const LOCATION_FORM_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`;

const TELECOM_MANAGED_SYSTEMS: ReadonlyArray<ContactPoint['system']> = ['phone', 'url', 'fax'];

const mergeTelecom = (existing: ContactPoint[] | undefined, update: TelecomUpdate): ContactPoint[] | undefined => {
  const others = (existing ?? []).filter(
    (cp) => !TELECOM_MANAGED_SYSTEMS.includes(cp.system as ContactPoint['system'])
  );
  const next: ContactPoint[] = [...others];
  const pushIfPresent = (system: ContactPoint['system'], raw: string | null | undefined): void => {
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (trimmed === '') return;
    next.push({ system, use: 'work', value: trimmed });
  };
  pushIfPresent('phone', update.phone);
  pushIfPresent('url', update.url);
  pushIfPresent('fax', update.fax);
  return next.length > 0 ? next : undefined;
};

const sanitizeAddress = (raw: Address | null | undefined): Address | undefined => {
  if (raw == null) {
    return undefined;
  }
  const line = (raw.line ?? [])
    .map((segment) => (typeof segment === 'string' ? segment.trim() : ''))
    .filter((segment) => segment !== '');
  const city = typeof raw.city === 'string' ? raw.city.trim() : '';
  const state = typeof raw.state === 'string' ? raw.state.trim() : '';
  const postalCode = typeof raw.postalCode === 'string' ? raw.postalCode.trim() : '';
  if (line.length === 0 && city === '' && state === '' && postalCode === '') {
    return undefined;
  }
  const address: Address = { use: 'work', type: 'physical' };
  if (line.length > 0) address.line = line;
  if (city !== '') address.city = city;
  if (state !== '') address.state = state;
  if (postalCode !== '') address.postalCode = postalCode;
  return address;
};

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<Schedule> => {
  const { updateDetails, currentSchedule, definiteDailySchedule, owner } = input;
  const {
    schedule: newSchedule,
    scheduleOverrides,
    closures,
    timezone,
    ownerSlug,
    isVirtual,
    stripeAccountId,
    advapacsLocationId,
    rooms,
    name,
    description,
    address,
    telecom,
    reviewLink,
  } = updateDetails;
  const scheduleExtension: ScheduleExtension = getScheduleExtension(currentSchedule) ?? {
    schedule: definiteDailySchedule,
    closures,
    scheduleOverrides: {},
  };
  // console.log('new schedule', JSON.stringify(newSchedule, null, 2));
  if (newSchedule !== undefined) {
    scheduleExtension.schedule = newSchedule;
  }
  console.log('scheduleOverrides', JSON.stringify(scheduleOverrides, null, 2));
  if (scheduleOverrides !== undefined) {
    scheduleExtension.scheduleOverrides = scheduleOverrides;
  }
  if (closures !== undefined) {
    scheduleExtension.closures = closures;
  }
  const newExtension = (currentSchedule.extension ?? []).filter((ext: Extension) => {
    if (ext.url === SCHEDULE_EXTENSION_URL) {
      return false;
    }
    if (timezone !== undefined && ext.url === TIMEZONE_EXTENSION_URL) {
      return false;
    }
    return true;
  });
  // console.log('scheduleExtension', JSON.stringify(scheduleExtension, null, 2));
  const scheduleJson = JSON.stringify(scheduleExtension);
  newExtension.push({
    url: SCHEDULE_EXTENSION_URL,
    valueString: scheduleJson,
  });
  if (timezone !== undefined) {
    // Validator guarantees a non-empty IANA tz string here; the strict-undefined check is
    // intentional so the truthy fast-path can't accidentally re-introduce an empty-string wipe.
    newExtension.push({
      url: TIMEZONE_EXTENSION_URL,
      valueString: timezone,
    });
  }
  // todo: this isn't very "RESTful" but works for now while further decoupling the schedule from the owner a potential
  // future task. note timezone is duplication on both schedule and owner for now.
  console.log('owner slug', ownerSlug);
  const ownerIsLocation = owner?.resourceType === 'Location';
  const locationFieldsToUpdate =
    ownerIsLocation &&
    (isVirtual !== undefined ||
      stripeAccountId !== undefined ||
      advapacsLocationId !== undefined ||
      rooms !== undefined ||
      description !== undefined ||
      address !== undefined ||
      telecom !== undefined ||
      reviewLink !== undefined);
  // Name editing is only supported for Location owners — Practitioner has HumanName[],
  // HealthcareService isn't surfaced in the UI. For non-Location owners, ignore the field
  // entirely so we don't bump the resource version with no actual change.
  const nameToUpdate = ownerIsLocation && name !== undefined;
  if (owner && (timezone || ownerSlug !== undefined || locationFieldsToUpdate || nameToUpdate)) {
    const ownerExtension = (owner.extension ?? []).filter((ext: Extension) => {
      // Preserve existing timezone extension unless caller is explicitly updating timezone.
      if (timezone !== undefined && ext.url === TIMEZONE_EXTENSION_URL) {
        return false;
      }
      // Only strip the 'vi' (virtual) coding; preserve any 'si' (facility group) coding on the same URL.
      if (
        ownerIsLocation &&
        isVirtual !== undefined &&
        ext.url === LOCATION_FORM_EXTENSION_URL &&
        ext.valueCoding?.code === 'vi'
      ) {
        return false;
      }
      if (ownerIsLocation && stripeAccountId !== undefined && ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL) {
        return false;
      }
      if (
        ownerIsLocation &&
        advapacsLocationId !== undefined &&
        ext.url === SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL
      ) {
        return false;
      }
      if (ownerIsLocation && rooms !== undefined && ext.url === ROOM_EXTENSION_URL) {
        return false;
      }
      if (ownerIsLocation && reviewLink !== undefined && ext.url === LOCATION_REVIEW_LINK_EXTENSION_URL) {
        return false;
      }
      return true;
    });
    // Preserve existing slug identifier unless caller is explicitly updating slug
    // (undefined = preserve, empty string = clear, non-empty = replace).
    const ownerIdentifier = (owner.identifier ?? []).filter((id) =>
      ownerSlug !== undefined ? id.system !== SLUG_SYSTEM : true
    );
    if (timezone !== undefined) {
      ownerExtension.push({
        url: TIMEZONE_EXTENSION_URL,
        valueString: timezone,
      });
    }
    if (ownerSlug) {
      ownerIdentifier.push({
        system: SLUG_SYSTEM,
        value: ownerSlug,
      });
    }
    if (ownerIsLocation) {
      if (isVirtual === true) {
        ownerExtension.push({
          url: LOCATION_FORM_EXTENSION_URL,
          valueCoding: {
            system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
            code: 'vi',
            display: 'Virtual',
          },
        });
      }
      if (typeof stripeAccountId === 'string' && stripeAccountId.trim() !== '') {
        ownerExtension.push({
          url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
          valueString: stripeAccountId.trim(),
        });
      }
      if (typeof advapacsLocationId === 'string' && advapacsLocationId.trim() !== '') {
        ownerExtension.push({
          url: SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
          valueString: advapacsLocationId.trim(),
        });
      }
      if (typeof reviewLink === 'string' && reviewLink.trim() !== '') {
        ownerExtension.push({
          url: LOCATION_REVIEW_LINK_EXTENSION_URL,
          valueUrl: reviewLink.trim(),
        });
      }
      if (rooms !== undefined) {
        rooms
          .map((room) => room.trim())
          .filter((room) => room !== '')
          .forEach((room) => {
            ownerExtension.push({
              url: ROOM_EXTENSION_URL,
              valueString: room,
            });
          });
      }
    }
    const ownerUpdate: ScheduleOwnerFhirResource = {
      ...owner,
      extension: ownerExtension,
      identifier: ownerIdentifier,
    };

    if (ownerIsLocation) {
      const locationUpdate = ownerUpdate as Location;
      if (typeof name === 'string') {
        const trimmedName = name.trim();
        if (trimmedName !== '') {
          locationUpdate.name = trimmedName;
        } else {
          delete locationUpdate.name;
        }
      }
      if (description !== undefined) {
        if (typeof description === 'string' && description.trim() !== '') {
          locationUpdate.description = description.trim();
        } else {
          delete locationUpdate.description;
        }
      }
      if (address !== undefined) {
        const sanitized = sanitizeAddress(address);
        if (sanitized) {
          locationUpdate.address = sanitized;
        } else {
          delete locationUpdate.address;
        }
      }
      if (telecom !== undefined) {
        if (telecom === null) {
          delete locationUpdate.telecom;
        } else {
          const merged = mergeTelecom(owner.telecom, telecom);
          if (merged) {
            locationUpdate.telecom = merged;
          } else {
            delete locationUpdate.telecom;
          }
        }
      }
    }

    await oystehr.fhir.update(ownerUpdate);
  }

  return await oystehr.fhir.update<Schedule>({
    ...currentSchedule,
    extension: newExtension,
  });
};

interface EffectInput {
  updateDetails: {
    timezone?: string;
    schedule?: DailySchedule;
    scheduleOverrides?: ScheduleOverrides;
    closures?: Closure[];
    ownerSlug: string | undefined;
    isVirtual?: boolean;
    stripeAccountId?: string | null;
    advapacsLocationId?: string | null;
    rooms?: string[];
    name?: string;
    description?: string | null;
    address?: Address | null;
    telecom?: TelecomUpdate | null;
    reviewLink?: string | null;
  };
  definiteDailySchedule: DailySchedule;
  currentSchedule: Schedule;
  owner: ScheduleOwnerFhirResource | undefined;
}

const complexValidation = async (input: UpdateScheduleBasicInput, oystehr: Oystehr): Promise<EffectInput> => {
  const {
    scheduleId,
    timezone,
    schedule: scheduleInput,
    scheduleOverrides,
    closures,
    isVirtual,
    stripeAccountId,
    advapacsLocationId,
    rooms,
    name,
    description,
    address,
    telecom,
    reviewLink,
  } = input;
  let definiteDailySchedule: DailySchedule;
  const schedule = await oystehr.fhir.get<Schedule>({ resourceType: 'Schedule', id: scheduleId });
  if (!schedule || !schedule.id) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  if (scheduleInput === undefined) {
    const scheduleExtension = getScheduleExtension(schedule);
    if (!scheduleExtension) {
      throw MISSING_SCHEDULE_EXTENSION_ERROR;
    }
    definiteDailySchedule = scheduleExtension.schedule;
  } else {
    definiteDailySchedule = scheduleInput;
  }

  const [actorType, actorId] = (schedule.actor ?? [])[0]?.reference?.split('/') ?? [];
  console.log('actorType, actorId', actorType, actorId);
  let owner: ScheduleOwnerFhirResource | undefined;
  if (
    actorType === 'Location' ||
    actorType === 'HealthcareService' ||
    actorType === 'Practitioner' ||
    actorType === 'PractitionerRole'
  ) {
    owner = await oystehr.fhir.get<ScheduleOwnerFhirResource>({ resourceType: actorType, id: actorId });
  }

  return {
    currentSchedule: schedule,
    updateDetails: {
      timezone: timezone,
      schedule: scheduleInput,
      scheduleOverrides,
      closures,
      ownerSlug: input.slug,
      isVirtual,
      stripeAccountId,
      advapacsLocationId,
      rooms,
      name,
      description,
      address,
      telecom,
      reviewLink,
    },
    definiteDailySchedule,
    owner,
  };
};
