import Oystehr, { RoleListItem, UserListItem } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Practitioner, PractitionerQualification, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EmployeeDetails,
  getAllNotificationRows,
  GetEmployeesResponse,
  getFirstName,
  getLastName,
  getProviderNotificationPreferencesV2,
  getResourcesFromBatchInlineRequests,
  PractitionerLicense,
  PractitionerQualificationCode,
  PromiseInnerType,
  RoleType,
  Secrets,
  standardizePhoneNumber,
} from 'utils';
import { getAuth0Token, getRoleMembers, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';
import { createClinicalOystehrClient } from '../../shared/helpers';
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

  const inactiveRoleId = existingRoles.find((role: any) => role.name === RoleType.Inactive)?.id;
  const providerRoleId = existingRoles.find((role: any) => role.name === RoleType.Provider)?.id;
  const customerSupportRoleId = existingRoles.find((role: any) => role.name === RoleType.CustomerSupport)?.id;
  if (!inactiveRoleId || !providerRoleId || !customerSupportRoleId) {
    throw new Error('Error searching for Inactive, Provider or CustomerSupport role.');
  }

  console.log(`Preparing the FHIR batch request (lite=${Boolean(lite)}).`);

  const practitionerIds = allEmployees
    .filter((employee) => employee.profile?.startsWith('Practitioner/'))
    .map((employee) => employee.profile.split('/')[1]);

  // Lite mode skips the organization-wide Encounter queries (used only for `seenPatientRecently`)
  // and trims Practitioner _elements to just what's needed for names.
  const fhirRequests = lite
    ? [`Practitioner?_id=${practitionerIds.join(',')}&_elements=id,name`]
    : (() => {
        const encounterCutDate = DateTime.now().minus({ minutes: 30 }).toFormat("yyyy-MM-dd'T'HH:mm");
        return [
          `Practitioner?_id=${practitionerIds.join(',')}&_elements=id,meta,qualification,name,extension,telecom`,
          `Encounter?status=in-progress&_elements=id,participant`,
          `Encounter?status=finished&date=gt${encounterCutDate}&_elements=id,participant`,
        ];
      })();
  const getResourcesRequest = getResourcesFromBatchInlineRequests(oystehr, fhirRequests);

  console.log('Do mixed promises in parallel...');

  const mixedPromises = [
    getRoleMembers(inactiveRoleId, oystehr),
    getRoleMembers(providerRoleId, oystehr),
    getRoleMembers(customerSupportRoleId, oystehr),
    getResourcesRequest,
  ];

  const [inactiveRoleMembers, providerRoleMembers, customerSupportRoleMembers, resources] = <
    [
      PromiseInnerType<ReturnType<typeof getRoleMembers>>,
      PromiseInnerType<ReturnType<typeof getRoleMembers>>,
      PromiseInnerType<ReturnType<typeof getRoleMembers>>,
      Resource[],
    ]
  >await Promise.all(mixedPromises);

  console.log(
    `Fetched ${inactiveRoleMembers.length} Inactive, ${providerRoleMembers.length} Provider and ${customerSupportRoleMembers.length} CustomerSupport role members.`
  );

  const inactiveMemberIds =
    inactiveRoleMembers.length > 0 ? inactiveRoleMembers?.map((member: { id: string }) => member.id) : undefined;
  const providerMemberIds = providerRoleMembers.map((member: { id: string }) => member.id);
  const customerSupportMemberIds = customerSupportRoleMembers.map((member: { id: string }) => member.id);

  const recentlyActivePractitioners: string[] = lite
    ? []
    : extractParticipantsRefsFromResources(resources as FhirResource[]);

  console.log('recentlyActivePractitioners.length:', recentlyActivePractitioners.length);

  const employeeDetails: EmployeeDetails[] = allEmployees.map((employee) => {
    const status = inactiveMemberIds?.includes(employee.id) ? 'Deactivated' : 'Active';
    const hasPractitionerProfile = employee.profile?.startsWith('Practitioner/');
    const practitionerId = hasPractitionerProfile ? employee.profile.split('/')[1] : undefined;
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
      isProvider: Boolean(providerMemberIds.includes(employee.id)),
      isCustomerSupport: Boolean(customerSupportMemberIds.includes(employee.id)),
      lastLogin: lite ? '' : (practitioner?.meta?.tag?.find((tag) => tag.system === 'last-login')?.code ?? ''),
      firstName: getFirstName(practitioner) ?? '',
      lastName: getLastName(practitioner) ?? '',
      phoneNumber: phone ? standardizePhoneNumber(phone)! : '',
      licenses: licenses,
      seenPatientRecently: recentlyActivePractitioners.includes(employee.profile),
      gettingAlerts: notificationPreferences
        ? getAllNotificationRows(notificationPreferences).some((row) => row.enabled)
        : false,
      needsReview: !hasPractitionerProfile,
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
