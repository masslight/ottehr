import { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { HealthcareService, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  BLANK_SCHEDULE_JSON_TEMPLATE,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  SCHEDULE_DISPLAY_NAME_EXTENSION_URL,
  SCHEDULE_EXTENSION_URL,
  Secrets,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { checkPractitionerRoleConflict } from '../admin-practitioner-role-shared/check-conflict';

interface AdminCreatePractitionerRoleInput {
  secrets: Secrets | null;
  practitionerId: string;
  locationId: string;
  /** HealthcareService ids tagged 'booking-service-category' that this role offers. */
  categoryHealthcareServiceIds: string[];
  /** IANA timezone name; written into a TIMEZONE_EXTENSION on the new Schedule. */
  timezone: string;
  /**
   * Optional admin-set display name. Written as a PR.extension valueString.
   * Empty/omitted means callers fall back to "<Practitioner> @ <Location>".
   */
  displayName?: string;
}

interface AdminCreatePractitionerRoleResponse {
  role: PractitionerRole;
  schedule: Schedule;
}

const ZAMBDA_NAME = 'admin-create-practitioner-role';
let m2mToken: string;

const validateRequestParameters = (input: ZambdaInput): AdminCreatePractitionerRoleInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;

  let parsed: {
    practitionerId?: unknown;
    locationId?: unknown;
    categoryHealthcareServiceIds?: unknown;
    timezone?: unknown;
    displayName?: unknown;
  };
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  const { practitionerId, locationId, categoryHealthcareServiceIds, timezone, displayName } = parsed;

  const missing: string[] = [];
  if (!practitionerId) missing.push('practitionerId');
  if (!locationId) missing.push('locationId');
  if (!timezone) missing.push('timezone');
  if (missing.length > 0) throw MISSING_REQUIRED_PARAMETERS(missing);

  if (typeof practitionerId !== 'string') throw INVALID_INPUT_ERROR('"practitionerId" must be a string');
  if (typeof locationId !== 'string') throw INVALID_INPUT_ERROR('"locationId" must be a string');
  if (typeof timezone !== 'string') throw INVALID_INPUT_ERROR('"timezone" must be a string');
  if (!Array.isArray(categoryHealthcareServiceIds))
    throw INVALID_INPUT_ERROR('"categoryHealthcareServiceIds" must be an array');
  if (!categoryHealthcareServiceIds.every((id) => typeof id === 'string'))
    throw INVALID_INPUT_ERROR('"categoryHealthcareServiceIds" must contain only strings');
  if (displayName !== undefined && typeof displayName !== 'string')
    throw INVALID_INPUT_ERROR('"displayName" must be a string if provided');

  return {
    secrets: input.secrets,
    practitionerId,
    locationId,
    categoryHealthcareServiceIds,
    timezone,
    displayName,
  };
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parsed = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parsed.secrets);
  const oystehr = createOystehrClient(m2mToken, parsed.secrets);

  // Reject configurations where this provider already has an active schedule
  // at this location offering one of the requested categories. We resolve
  // category names from the requested ids so the error is human-readable.
  const categoryNameById = new Map<string, string>();
  if (parsed.categoryHealthcareServiceIds.length > 0) {
    const hsBundle = await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [{ name: '_id', value: parsed.categoryHealthcareServiceIds.join(',') }],
    });
    for (const hs of hsBundle.unbundle()) {
      if (hs.id) categoryNameById.set(hs.id, hs.name ?? hs.id);
    }
  }
  const conflict = await checkPractitionerRoleConflict(
    oystehr,
    {
      practitionerRef: `Practitioner/${parsed.practitionerId}`,
      locationRef: `Location/${parsed.locationId}`,
      categoryHsIds: parsed.categoryHealthcareServiceIds,
    },
    { categoryNameById }
  );
  if (conflict) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        code: 'PRACTITIONER_SCHEDULE_CONFLICT',
        message: `This provider already has an active schedule at this location offering ${conflict.conflictingCategoryNames.join(
          ', '
        )}. Remove ${
          conflict.conflictingCategoryNames.length === 1 ? 'it' : 'them'
        } from that schedule first, or pick a different location.`,
        conflictingScheduleId: conflict.conflictingScheduleId,
        conflictingCategoryNames: conflict.conflictingCategoryNames,
      }),
    };
  }

  // Create the PractitionerRole and its Schedule in a single FHIR transaction
  // so the partial-failure case (PR exists, Schedule missing) can't happen.
  const roleFullUrl = `urn:uuid:${randomUUID()}`;
  const trimmedName = parsed.displayName?.trim();
  const roleResource: PractitionerRole = {
    resourceType: 'PractitionerRole',
    active: true,
    practitioner: { reference: `Practitioner/${parsed.practitionerId}` },
    location: [{ reference: `Location/${parsed.locationId}` }],
    healthcareService: parsed.categoryHealthcareServiceIds.map((id) => ({
      reference: `HealthcareService/${id}`,
    })),
    ...(trimmedName ? { extension: [{ url: SCHEDULE_DISPLAY_NAME_EXTENSION_URL, valueString: trimmedName }] } : {}),
  };
  const scheduleResource: Schedule = {
    resourceType: 'Schedule',
    active: true,
    actor: [{ reference: roleFullUrl }],
    extension: [
      { url: SCHEDULE_EXTENSION_URL, valueString: JSON.stringify(BLANK_SCHEDULE_JSON_TEMPLATE) },
      { url: TIMEZONE_EXTENSION_URL, valueString: parsed.timezone },
    ],
  };

  const requests: BatchInputRequest<PractitionerRole | Schedule>[] = [
    {
      method: 'POST',
      url: '/PractitionerRole',
      fullUrl: roleFullUrl,
      resource: roleResource,
    } as BatchInputPostRequest<PractitionerRole>,
    {
      method: 'POST',
      url: '/Schedule',
      resource: scheduleResource,
    } as BatchInputPostRequest<Schedule>,
  ];

  const result = await oystehr.fhir.transaction<PractitionerRole | Schedule>({ requests });
  const created = (result.entry ?? []).map((e) => e.resource).filter((r): r is PractitionerRole | Schedule => !!r);
  const role = created.find((r): r is PractitionerRole => r.resourceType === 'PractitionerRole');
  const schedule = created.find((r): r is Schedule => r.resourceType === 'Schedule');
  if (!role || !schedule) {
    throw new Error('Transaction did not return both a PractitionerRole and a Schedule');
  }

  const response: AdminCreatePractitionerRoleResponse = { role, schedule };
  return { statusCode: 200, body: JSON.stringify(response) };
});
