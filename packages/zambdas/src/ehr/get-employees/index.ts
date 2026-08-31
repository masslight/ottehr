import Oystehr, { RoleListItem, UserListItem } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Practitioner, PractitionerQualification, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getFirstName, getLastName, getProviderNotificationPreferencesV2 } from 'utils/lib/fhir/patient';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import { EmployeeDetails, GetEmployeesResponse } from 'utils/lib/types/api/get-employees/get-employees.types';
import { PractitionerLicense, PractitionerQualificationCode } from 'utils/lib/types/api/practitioner.types';
import { getAllNotificationRows } from 'utils/lib/types/api/provider-notifications';
import { AVAILABLE_EMPLOYEE_ROLES, hasPractitionerProfile, RoleType } from 'utils/lib/types/api/user.types';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { lambdaResponse } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { getRoleMembers } from '../../shared/users.helper';
import { validateRequestParameters } from './validateRequestParameters';

// For local development it makes it easier to track performance
if (process.env.IS_OFFLINE === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}

export interface GetEmployeesInput {
  secrets: Secrets | null;
  /**
   * When true, skips the expensive Encounter queries and the heavy Practitioner enrichment
   * (qualifications, telecom, notification settings, last-login meta). Use this when the caller
   * only needs id, name, and role classification — e.g. populating dropdowns. The fields that
   * depend on the skipped work (`seenPatientRecently`, `gettingAlerts`, `licenses`,
   * `phoneNumber`, `lastLogin`) are returned as empty/default values.
   */
  lite?: boolean;
}

let oystehrToken: string;
export const index = wrapHandler('get-employees', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { secrets, lite } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(secrets);
  } else {
    console.log('already have token');
  }

  const oystehr = createClinicalOystehrClient(oystehrToken, secrets);

  const promises: [Promise<UserListItem[]>, Promise<RoleListItem[]>] = [getEmployees(oystehr), getRoles(oystehr)];
  const [allEmployees, existingRoles] = await Promise.all(promises);

  console.log(`Fetched ${allEmployees.length} employees and ${existingRoles.length} roles.`);

  const inactiveRoleId = existingRoles.find((role) => role.name === RoleType.Inactive)?.id;
  if (!inactiveRoleId) {
    throw new Error('Error searching for the Inactive role.');
  }

  // Every assignable role, so callers can filter and display roles directly rather than working from
  // a handful of derived booleans. A project that hasn't provisioned one of these roles yet simply
  // has no members for it, which is not an error — only Inactive is required, since `status` needs it.
  const assignableRoles = AVAILABLE_EMPLOYEE_ROLES.map(({ value }) => ({
    role: value,
    id: existingRoles.find((role) => role.name === value)?.id,
  })).filter((entry): entry is { role: RoleType; id: string } => Boolean(entry.id));

  console.log(`Preparing the FHIR batch request (lite=${Boolean(lite)}).`);

  const practitionerIds = allEmployees
    .filter((employee) => employee.profile?.startsWith('Practitioner/'))
    .map((employee) => employee.profile.split('/')[1]);

  // Lite mode skips the Encounter queries (used only for `seenPatientRecently`) and trims
  // Practitioner _elements to just what's needed for names.
  //
  // These used to be one `fhir.batch` of inline GETs, but a FHIR batch runs its entries one after
  // another server-side, so the batch cost the SUM of the three searches — and one of them dominated
  // everything. Issued as concurrent searches, the cost is the max instead. They are also POST
  // searches rather than batch GETs, so the participant filter below is not constrained by URL
  // length.
  const encounterCutDate = DateTime.now().minus({ minutes: 30 }).toFormat("yyyy-MM-dd'T'HH:mm");
  const practitionerRefs = practitionerIds.map((id) => `Practitioner/${id}`);

  const practitionerSearch: Promise<Resource[]> = practitionerIds.length
    ? oystehr.fhir
        .search<Practitioner>({
          resourceType: 'Practitioner',
          params: [
            { name: '_id', value: practitionerIds.join(',') },
            {
              name: '_elements',
              value: lite ? 'id,name' : 'id,meta,qualification,name,extension,telecom',
            },
            { name: '_count', value: `${practitionerIds.length}` },
          ],
        })
        .then((bundle) => bundle.unbundle())
    : Promise.resolve([]);

  const encounterSearches: Promise<Resource[]>[] = lite
    ? []
    : [
        oystehr.fhir
          .search<FhirResource>({
            resourceType: 'Encounter',
            params: [
              { name: 'status', value: 'in-progress' },
              { name: '_elements', value: 'id,participant' },
            ],
          })
          .then((bundle) => bundle.unbundle()),
        // Scoped to the employees whose refs are the only ones this endpoint goes on to test. The
        // unscoped version of this search was by far the most expensive thing the endpoint did
        // (measured at ~3.5s against ~190ms scoped); the result is the same, because an encounter can
        // only contribute an employee's ref if that employee participates in it, which is exactly
        // what the filter selects for.
        oystehr.fhir
          .search<FhirResource>({
            resourceType: 'Encounter',
            params: [
              { name: 'status', value: 'finished' },
              { name: 'date', value: `gt${encounterCutDate}` },
              ...(practitionerRefs.length ? [{ name: 'participant', value: practitionerRefs.join(',') }] : []),
              { name: '_elements', value: 'id,participant' },
            ],
          })
          .then((bundle) => bundle.unbundle()),
      ];

  const getResourcesRequest = Promise.all([practitionerSearch, ...encounterSearches]).then((results) => results.flat());

  console.log('Do mixed promises in parallel...');

  const [inactiveRoleMembers, assignableRoleMembers, resources] = await Promise.all([
    getRoleMembers(inactiveRoleId, oystehr),
    Promise.all(assignableRoles.map(async ({ role, id }) => ({ role, members: await getRoleMembers(id, oystehr) }))),
    getResourcesRequest as Promise<Resource[]>,
  ]);

  console.log(
    `Fetched ${inactiveRoleMembers.length} Inactive role members and ` +
      assignableRoleMembers.map(({ role, members }) => `${members.length} ${role}`).join(', ')
  );

  const inactiveMemberIds = new Set(inactiveRoleMembers.map((member) => member.id));

  // userId -> roles held. Built once so the per-employee mapping below stays a lookup rather than a
  // scan of every role's membership list.
  const rolesByUserId = new Map<string, RoleType[]>();
  for (const { role, members } of assignableRoleMembers) {
    for (const member of members) {
      const existing = rolesByUserId.get(member.id);
      if (existing) existing.push(role);
      else rolesByUserId.set(member.id, [role]);
    }
  }

  const recentlyActivePractitioners: string[] = lite
    ? []
    : extractParticipantsRefsFromResources(resources as FhirResource[]);

  console.log('recentlyActivePractitioners.length:', recentlyActivePractitioners.length);

  const employeeDetails: EmployeeDetails[] = allEmployees.map((employee) => {
    const status = inactiveMemberIds.has(employee.id) ? 'Deactivated' : 'Active';
    const isPractitioner = hasPractitionerProfile(employee.profile);
    const practitionerId = isPractitioner ? employee.profile.split('/')[1] : undefined;
    const practitioner = practitionerId
      ? (resources.find((resource) => resource.id === practitionerId) as Practitioner | undefined)
      : undefined;

    const phone = lite ? undefined : practitioner?.telecom?.find((telecom) => telecom.system === 'sms')?.value;

    const licenses: PractitionerLicense[] = [];
    if (!lite && practitioner?.qualification) {
      practitioner.qualification.forEach((qualification: PractitionerQualification) => {
        const qualificationStatusCode =
          qualification.extension?.[0].extension?.[1].valueCodeableConcept?.coding?.[0].code;
        const qualificationCode = qualification.code.coding?.[0].code as PractitionerQualificationCode;
        if (qualificationStatusCode && qualificationCode) {
          // Use direct mapping same as in get-user lambda, without checking for extension.urls.
          licenses.push({
            state: qualificationStatusCode,
            code: qualificationCode,
            active: qualification.extension?.[0].extension?.[0].valueCode === 'active',
          });
        }
      });
    }

    const notificationPreferences = lite ? undefined : getProviderNotificationPreferencesV2(practitioner);
    return {
      id: employee.id,
      profile: employee.profile,
      name: employee.name,
      email: employee.email,
      status: status,
      roles: rolesByUserId.get(employee.id) ?? [],
      lastLogin: lite ? '' : practitioner?.meta?.tag?.find((tag) => tag.system === 'last-login')?.code ?? '',
      firstName: getFirstName(practitioner) ?? '',
      lastName: getLastName(practitioner) ?? '',
      phoneNumber: phone ? standardizePhoneNumber(phone)! : '',
      licenses: licenses,
      seenPatientRecently: recentlyActivePractitioners.includes(employee.profile),
      gettingAlerts: notificationPreferences
        ? getAllNotificationRows(notificationPreferences).some((row) => row.enabled)
        : false,
      needsReview: !isPractitioner,
    };
  });

  const response: GetEmployeesResponse = {
    message: `Successfully retrieved employee details`,
    employees: employeeDetails,
  };

  return lambdaResponse(200, response);
});

async function getEmployees(oystehr: Oystehr): Promise<UserListItem[]> {
  console.log('Getting all employees..');
  // Include email-based users even when they have no Practitioner profile
  // (e.g. self-signup users stuck on the Patient role), so admins can reclassify them.
  const allEmployees = (await oystehr.user.list()).filter((user) => !user.name.startsWith('+'));
  return allEmployees;
}

async function getRoles(oystehr: Oystehr): Promise<RoleListItem[]> {
  console.log('Getting roles...');
  return oystehr.role.list();
}

function extractParticipantsRefsFromResources(bundleResources: FhirResource[]): string[] {
  const participantSet: string[] = [];
  bundleResources.forEach((res) => {
    if (res.resourceType === 'Encounter' && res.participant) {
      res.participant.forEach((participant) => {
        if (participant.individual?.reference) {
          participantSet.push(participant.individual.reference);
        }
      });
    }
  });

  return participantSet.filter((participant) => participant && participant.match(/^Practitioner\//) !== null);
}
