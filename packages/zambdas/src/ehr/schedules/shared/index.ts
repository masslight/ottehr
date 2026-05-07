import Oystehr from '@oystehr/sdk';
import { Address, FhirResource, HealthcareService, Location, Practitioner, PractitionerRole } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ClosureType,
  getFullName,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  OVERRIDE_DATE_FORMAT,
  Secrets,
  TIMEZONES,
  UpdateScheduleParams,
} from 'utils';
import { ZambdaInput } from '../../../shared';

export const addressStringFromAddress = (address: Address): string => {
  let addressString = '';
  if (address.line) {
    addressString += `, ${address.line}`;
  }
  if (address.city) {
    addressString += `, ${address.city}`;
  }
  if (address.state) {
    addressString += `, ${address.state}`;
  }
  if (address.postalCode) {
    addressString += `, ${address.postalCode}`;
  }
  // return without trailing comma

  if (addressString !== '') {
    addressString = addressString.substring(2);
  }
  return addressString;
};

export const getNameForOwner = (owner: FhirResource): string => {
  let name: string | undefined = '';
  if (owner.resourceType === 'Location') {
    name = (owner as Location).name;
  } else if (owner.resourceType === 'HealthcareService') {
    name = (owner as HealthcareService).name;
  }
  if (name) {
    return name;
  }
  return `${owner.resourceType}/${owner.id}`;
};

/**
 * Compose a display name for a PractitionerRole owner: "Dr. Smith — Main Clinic".
 * Fetches the referenced Practitioner and Location to build the string. Returns
 * the role's id-fallback if the references can't be resolved.
 */
export const getNameForPractitionerRole = async (role: PractitionerRole, oystehr: Oystehr): Promise<string> => {
  const practitionerId = role.practitioner?.reference?.split('/')[1];
  const locationId = role.location?.[0]?.reference?.split('/')[1];
  const [practitioner, location] = await Promise.all([
    practitionerId
      ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId }).catch(() => undefined)
      : Promise.resolve(undefined),
    locationId
      ? oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  const practitionerName = practitioner ? getFullName(practitioner) : 'Unknown provider';
  const locationName = location?.name ?? 'Unknown location';
  return `${practitionerName} — ${locationName}`;
};

export interface UpdateScheduleBasicInput extends UpdateScheduleParams {
  secrets: Secrets | null;
}

// this lives here because the create schedule zambda uses an input type that extends UpdateScheduleParams,
// so this can be shared across the update and create zambdas
export const validateUpdateScheduleParameters = (input: ZambdaInput): UpdateScheduleBasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { scheduleId, timezone, slug, schedule, scheduleOverrides, closures, ownerId, ownerType } = JSON.parse(
    input.body
  );
  const createMode = Boolean(ownerId) && Boolean(ownerType);

  if (!scheduleId) {
    throw MISSING_REQUIRED_PARAMETERS(['scheduleId']);
  }

  if (isValidUUID(scheduleId) === false && createMode === false) {
    throw INVALID_RESOURCE_ID_ERROR('scheduleId');
  }

  if (timezone) {
    if (typeof timezone !== 'string') {
      throw INVALID_INPUT_ERROR('"timezone" must be a string');
    }
    if (TIMEZONES.includes(timezone) === false) {
      throw INVALID_INPUT_ERROR(`"timezone" must be one of ${TIMEZONES.join(', ')}`);
    }
  }
  // todo: better schema application for these complex structures
  if (schedule) {
    if (typeof schedule !== 'object') {
      throw INVALID_INPUT_ERROR('"schedule" must be an object');
    }
  }
  if (scheduleOverrides) {
    if (typeof scheduleOverrides !== 'object') {
      throw INVALID_INPUT_ERROR('"scheduleOverrides" must be an object');
    }
  }
  if (closures) {
    if (!Array.isArray(closures)) {
      throw INVALID_INPUT_ERROR('"closures" must be an array');
    }
    closures.forEach((closure) => {
      if (typeof closure !== 'object') {
        throw INVALID_INPUT_ERROR('"closures" must be an array of objects');
      }
      if (!closure.start) {
        throw INVALID_INPUT_ERROR('"closures" must be an array of objects with start date');
      } else if (DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT).isValid === false) {
        throw INVALID_INPUT_ERROR(
          `"closures" start dates must be valid date strings in ${OVERRIDE_DATE_FORMAT} format`
        );
      }
      if (closure.end && DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT).isValid === false) {
        throw INVALID_INPUT_ERROR(`"closures" end dates must be valid date strings in ${OVERRIDE_DATE_FORMAT} format`);
      }
      if (Object.values(ClosureType).includes(closure.type) === false) {
        throw INVALID_INPUT_ERROR(
          `"closures" must be an array of objects with a type of ${Object.values(ClosureType).join(', ')}`
        );
      } else if (closure.type === 'period' && !closure.end) {
        throw INVALID_INPUT_ERROR('"closures" of type "period" must have an end date');
      } else if (
        closure.type === 'period' &&
        DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT) >=
          DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT)
      ) {
        throw INVALID_INPUT_ERROR('"closures" of type "period" must have start date before end date');
      }
    });
  }

  if (slug && typeof slug !== 'string') {
    throw INVALID_INPUT_ERROR('"slug" must be a string');
  }

  return {
    secrets,
    scheduleId,
    timezone,
    schedule,
    scheduleOverrides,
    closures,
    slug,
  };
};
