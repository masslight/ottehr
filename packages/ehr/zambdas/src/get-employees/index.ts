import Oystehr, { RoleListItem, UserListItem } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, Practitioner, PractitionerQualification, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EmployeeDetails,
  GetEmployeesResponse,
  getProviderNotificationSettingsForPractitioner,
  getResourcesFromBatchInlineRequests,
  PractitionerLicense,
  PractitionerQualificationCode,
  PromiseInnerType,
  RoleType,
  standardizePhoneNumber,
} from 'utils';
import { Secrets } from 'zambda-utils';
import { getAuth0Token, getRoleMembers, lambdaResponse } from '../shared';
import { topLevelCatch } from '../shared/errors';
import { createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';

// For local development it makes it easier to track performance
if (process.env.IS_OFFLINE === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}

export interface GetEmployeesInput {
  secrets: Secrets | null;
}

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    const promises: [Promise<UserListItem[]>, Promise<RoleListItem[]>] = [getEmployees(oystehr), getRoles(oystehr)];
    const [allEmployees, existingRoles] = await Promise.all(promises);

    console.log(`Fetched ${allEmployees.length} employees and ${existingRoles.length} roles.`);

    const inactiveRoleId = existingRoles.find((role: any) => role.name === RoleType.Inactive)?.id;
    const providerRoleId = existingRoles.find((role: any) => role.name === RoleType.Provider)?.id;
    if (!inactiveRoleId || !providerRoleId) {
      throw new Error('Error searching for Inactive or Provider role.');
    }

    console.log('Preparing the FHIR batch request.');

    const practitionerIds = allEmployees.map((employee) => employee.profile.split('/')[1]);
    const encounterCutDate = DateTime.now().minus({ minutes: 30 }).toFormat("yyyy-MM-dd'T'HH:mm");
    const getResourcesRequest = getResourcesFromBatchInlineRequests(oystehr, [
      `Practitioner?_id=${practitionerIds.join(',')}&_elements=id,meta,qualification,name,extension`,
      `Encounter?status=in-progress&_elements=id,participant`,
      `Encounter?status=finished&date=gt${encounterCutDate}&_elements=id,participant`,
    ]);

    console.log('Do mixed promises in parallel...');

    const mixedPromises = [
      getRoleMembers(inactiveRoleId, oystehr),
      getRoleMembers(providerRoleId, oystehr),
      getResourcesRequest,
    ];

    const [inactiveRoleMembers, providerRoleMembers, resources] = <
      [
        PromiseInnerType<ReturnType<typeof getRoleMembers>>,
        PromiseInnerType<ReturnType<typeof getRoleMembers>>,
        Resource[],
      ]
    >await Promise.all(mixedPromises);

    console.log(
      `Fetched ${inactiveRoleMembers.length} Inactive and ${providerRoleMembers.length} Provider role members.`
    );

    const inactiveMemberIds =
      inactiveRoleMembers.length > 0 ? inactiveRoleMembers?.map((member: { id: string }) => member.id) : undefined;
    const providerMemberIds = providerRoleMembers.map((member: { id: string }) => member.id);

    const recentlyActivePractitioners: string[] = extractParticipantsRefsFromResources(resources as FhirResource[]);

    console.log('recentlyActivePractitioners.length:', recentlyActivePractitioners.length);

    const employeeDetails: EmployeeDetails[] = allEmployees.map((employee) => {
      const status = inactiveMemberIds?.includes(employee.id) ? 'Deactivated' : 'Active';
      const practitionerId = employee.profile.split('/')[1];
      const practitioner = resources.find((resource) => resource.id === practitionerId) as Practitioner | undefined;

      const phone = practitioner?.telecom?.find((telecom) => telecom.system === 'phone')?.value;

      const licenses: PractitionerLicense[] = [];
      if (practitioner?.qualification) {
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

      return {
        id: employee.id,
        profile: employee.profile,
        name: employee.name,
        email: employee.email,
        status: status,
        isProvider: Boolean(providerMemberIds.includes(employee.id)),
        lastLogin: practitioner?.meta?.tag?.find((tag) => tag.system === 'last-login')?.code ?? '',
        firstName: practitioner?.name?.[0].given?.join(' ') ?? '',
        lastName: practitioner?.name?.[0].family ?? '',
        phoneNumber: phone ? standardizePhoneNumber(phone)! : '',
        licenses: licenses,
        seenPatientRecently: recentlyActivePractitioners.includes(employee.profile),
        gettingAlerts: getProviderNotificationSettingsForPractitioner(practitioner)?.enabled || false,
      };
    });

    const response: GetEmployeesResponse = {
      message: `Successfully retrieved employee details`,
      employees: employeeDetails,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    await topLevelCatch('admin-get-employee-details', error, input.secrets);
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, error.message);
  }
};

async function getEmployees(oystehr: Oystehr): Promise<UserListItem[]> {
  console.log('Getting all employees..');
  const allEmployees = (await oystehr.user.list()).filter(
    (user) => !user.name.startsWith('+') && user.profile.includes('Practitioner')
  );
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
