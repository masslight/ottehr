import { Address, ContactPoint, Extension, Location } from 'fhir/r4b';
import {
  LOCATION_FORM_EXTENSION_URL,
  LOCATION_IN_PERSON_CODE,
  LOCATION_MANUALLY_CREATED_EXTENSION_URL,
  LOCATION_PHYSICAL_TYPE_SYSTEM,
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  LocationFieldsInput,
  RoleType,
  ROOM_EXTENSION_URL,
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  Secrets,
  SLUG_SYSTEM,
  slugFromName,
  TelecomUpdate,
  TIMEZONE_EXTENSION_URL,
  TIMEZONES,
  userMe,
} from 'utils';
import { z } from 'zod';

/**
 * Zod shape for the intrinsic Location fields, shared by create + update so their
 * validation can't drift. Address/telecom are validated loosely here (as objects)
 * and structurally sanitized by applyLocationFields.
 */
export const locationFieldsSchema = {
  description: z.string().nullish(),
  address: z.record(z.any()).nullish(),
  telecom: z.record(z.any()).nullish(),
  rooms: z.array(z.string()).optional(),
  isVirtual: z.boolean().optional(),
  isInPerson: z.boolean().optional(),
  slug: z.string().optional(),
  timezone: z.string().optional(),
  stripeAccountId: z.string().nullish(),
  advapacsLocationId: z.string().nullish(),
  reviewLink: z.string().nullish(),
};

const PAYMENT_FIELD_ROLES: ReadonlyArray<string> = [RoleType.CustomerSupport];

/**
 * Payment-related fields (stripe / advapacs) may only be set by Customer Support.
 * The backend is the source of truth even if the UI also hides them for other roles.
 */
export const callerCanEditPaymentFields = async (
  authorizationHeader: string | undefined,
  secrets: Secrets | null
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
  // Country is always US until the product supports other countries; backend-written
  // so it can't drift or be omitted.
  const address: Address = { use: 'work', type: 'physical', country: 'US' };
  if (line.length > 0) address.line = line;
  if (city !== '') address.city = city;
  if (state !== '') address.state = state;
  if (postalCode !== '') address.postalCode = postalCode;
  return address;
};

/**
 * Applies the intrinsic Location fields to a Location, returning a new resource.
 * `undefined` fields are left untouched; codings/extensions are surgically replaced
 * so unrelated ones (e.g. a facility-group coding) survive. `isInPerson: false`
 * removes the in-person coding (strip-if-defined, add-if-true), same for virtual.
 * Payment fields are assumed pre-authorized — each zambda gates them up-front.
 */
export const applyLocationFields = (location: Location, fields: LocationFieldsInput): Location => {
  const {
    name,
    description,
    address,
    telecom,
    rooms,
    isVirtual,
    isInPerson,
    slug,
    timezone,
    stripeAccountId,
    advapacsLocationId,
    reviewLink,
  } = fields;

  const extension = (location.extension ?? []).filter((ext: Extension) => {
    if (timezone !== undefined && ext.url === TIMEZONE_EXTENSION_URL) return false;
    if (isVirtual !== undefined && ext.url === LOCATION_FORM_EXTENSION_URL && ext.valueCoding?.code === 'vi')
      return false;
    if (
      isInPerson !== undefined &&
      ext.url === LOCATION_FORM_EXTENSION_URL &&
      ext.valueCoding?.code === LOCATION_IN_PERSON_CODE
    )
      return false;
    if (stripeAccountId !== undefined && ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL) return false;
    if (advapacsLocationId !== undefined && ext.url === SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL) return false;
    if (rooms !== undefined && ext.url === ROOM_EXTENSION_URL) return false;
    if (reviewLink !== undefined && ext.url === LOCATION_REVIEW_LINK_EXTENSION_URL) return false;
    return true;
  });

  if (timezone !== undefined) extension.push({ url: TIMEZONE_EXTENSION_URL, valueString: timezone });
  if (isVirtual === true)
    extension.push({
      url: LOCATION_FORM_EXTENSION_URL,
      valueCoding: { system: LOCATION_PHYSICAL_TYPE_SYSTEM, code: 'vi', display: 'Virtual' },
    });
  if (isInPerson === true)
    extension.push({
      url: LOCATION_FORM_EXTENSION_URL,
      valueCoding: { system: LOCATION_PHYSICAL_TYPE_SYSTEM, code: LOCATION_IN_PERSON_CODE, display: 'In Person' },
    });
  if (typeof stripeAccountId === 'string' && stripeAccountId.trim() !== '')
    extension.push({ url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccountId.trim() });
  if (typeof advapacsLocationId === 'string' && advapacsLocationId.trim() !== '')
    extension.push({ url: SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL, valueString: advapacsLocationId.trim() });
  if (typeof reviewLink === 'string' && reviewLink.trim() !== '')
    extension.push({ url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: reviewLink.trim() });
  if (rooms !== undefined)
    rooms
      .map((room) => room.trim())
      .filter((room) => room !== '')
      .forEach((room) => extension.push({ url: ROOM_EXTENSION_URL, valueString: room }));

  const identifier = (location.identifier ?? []).filter((id) =>
    slug !== undefined ? id.system !== SLUG_SYSTEM : true
  );
  if (slug) identifier.push({ system: SLUG_SYSTEM, value: slug });

  const updated: Location = { ...location, extension, identifier };

  if (typeof name === 'string') {
    const trimmed = name.trim();
    if (trimmed !== '') updated.name = trimmed;
    else delete updated.name;
  }
  if (description !== undefined) {
    if (typeof description === 'string' && description.trim() !== '') updated.description = description.trim();
    else delete updated.description;
  }
  if (address !== undefined) {
    const sanitized = sanitizeAddress(address);
    if (sanitized) updated.address = sanitized;
    else delete updated.address;
  }
  if (telecom !== undefined) {
    if (telecom === null) {
      delete updated.telecom;
    } else {
      const merged = mergeTelecom(location.telecom, telecom);
      if (merged) updated.telecom = merged;
      else delete updated.telecom;
    }
  }

  return updated;
};

/**
 * A fully-formed, patient-booking-eligible default Location (active, slugged,
 * in-person, timezone, marked manually-created) — the server-side equivalent of the
 * EHR "Add location" scaffold. Deliberately creates NO Schedule: availability comes
 * only from a Schedule attached later (or a provider's schedule anchored here).
 */
export const scaffoldLocation = (name: string): Location => ({
  resourceType: 'Location',
  status: 'active',
  name: name.trim(),
  identifier: [{ system: SLUG_SYSTEM, value: slugFromName(name) }],
  extension: [
    { url: TIMEZONE_EXTENSION_URL, valueString: TIMEZONES[0] },
    {
      url: LOCATION_FORM_EXTENSION_URL,
      valueCoding: { system: LOCATION_PHYSICAL_TYPE_SYSTEM, code: LOCATION_IN_PERSON_CODE, display: 'In Person' },
    },
    { url: LOCATION_MANUALLY_CREATED_EXTENSION_URL, valueBoolean: true },
  ],
});
