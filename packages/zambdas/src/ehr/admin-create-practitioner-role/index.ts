import { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { PractitionerRole, Schedule } from 'fhir/r4b';
import { BLANK_SCHEDULE_JSON_TEMPLATE, SCHEDULE_EXTENSION_URL, TIMEZONE_EXTENSION_URL } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';

interface AdminCreatePractitionerRoleInput {
  practitionerId: string;
  locationId: string;
  /** HealthcareService ids tagged 'booking-service-category' that this role offers. */
  categoryHealthcareServiceIds: string[];
  /** IANA timezone name; written into a TIMEZONE_EXTENSION on the new Schedule. */
  timezone: string;
}

interface AdminCreatePractitionerRoleResponse {
  role: PractitionerRole;
  schedule: Schedule;
}

const ZAMBDA_NAME = 'admin-create-practitioner-role';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw new Error('No request body provided');
  if (!input.secrets) throw new Error('No secrets provided');
  const parsed = JSON.parse(input.body) as Partial<AdminCreatePractitionerRoleInput>;

  if (!parsed.practitionerId || typeof parsed.practitionerId !== 'string') {
    throw new Error('practitionerId is required');
  }
  if (!parsed.locationId || typeof parsed.locationId !== 'string') {
    throw new Error('locationId is required');
  }
  if (!Array.isArray(parsed.categoryHealthcareServiceIds)) {
    throw new Error('categoryHealthcareServiceIds must be an array');
  }
  if (!parsed.timezone || typeof parsed.timezone !== 'string') {
    throw new Error('timezone is required');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  // Create the PractitionerRole and its Schedule in a single FHIR transaction
  // so the partial-failure case (PR exists, Schedule missing) can't happen.
  const roleFullUrl = `urn:uuid:${randomUUID()}`;
  const roleResource: PractitionerRole = {
    resourceType: 'PractitionerRole',
    active: true,
    practitioner: { reference: `Practitioner/${parsed.practitionerId}` },
    location: [{ reference: `Location/${parsed.locationId}` }],
    healthcareService: parsed.categoryHealthcareServiceIds.map((id) => ({
      reference: `HealthcareService/${id}`,
    })),
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
