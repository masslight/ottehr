import { BatchInputRequest, User } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, Practitioner } from 'fhir/r4';
import { DateTime } from 'luxon';
import { PractitionerLicense, Secrets, standardizePhoneNumber } from 'ehr-utils';
import { getAuth0Token, getSecret, lambdaResponse } from '../shared';
import { topLevelCatch } from '../shared/errors';
import { createAppClient, createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetEmployeesInput {
  secrets: Secrets | null;
}

interface EmployeeDetails {
  id: string;
  profile: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: 'Active' | 'Deactivated';
  lastLogin: string;
  licenses: PractitionerLicense[];
  seenPatientRecently: boolean;
  isProvider: boolean;
}

interface GetEmployeesResponse {
  message: string;
  employees: EmployeeDetails[];
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

    const fhirClient = createFhirClient(zapehrToken, secrets);

    const promises = [getEmployees(zapehrToken, secrets), getRoles(zapehrToken, secrets)];
    const [allEmployees, existingRoles] = await Promise.all(promises);

    console.log('allEmployees', allEmployees);
    console.log('existingRoles', existingRoles);

    console.log(`Fetched ${allEmployees.length} employees and ${existingRoles.length} roles.`);

    const inactiveRoleId = existingRoles.find((role: any) => role.name === 'Inactive')?.id;
    const providerRoleId = existingRoles.find((role: any) => role.name === 'Provider')?.id;
    if (!inactiveRoleId || !providerRoleId) {
      throw new Error('Error searching for Inactive or Provider role.');
    }

    console.log('Preparing the FHIR batch request.');

    const practitionerIds = allEmployees.map((employee) => employee.profile.split('/')[1]);
    const encounterCutDate = DateTime.now().minus({ minutes: 30 }).toFormat("yyyy-MM-dd'T'HH:mm");
    const batchRequests: BatchInputRequest[] = [
      {
        method: 'GET',
        url: `Practitioner?_id=${practitionerIds.join(',')}&_elements=id,meta,qualification,name`,
      },
      {
        method: 'GET',
        url: `Encounter?status=in-progress&_elements=id,participant`,
      },
      {
        method: 'GET',
        url: `Encounter?status=finished&date=gt${encounterCutDate}&_elements=id,participant`,
      },
    ];

    console.log('Do mixed promises in parallel...');

    const mixedPromises = [
      getRoleMembers(inactiveRoleId, zapehrToken, secrets),
      getRoleMembers(providerRoleId, zapehrToken, secrets),
      fhirClient.batchRequest({ requests: batchRequests }),
    ];

    const [inactiveRoleMembers, providerRoleMembers, fhirBundle] = <[{ id: string }[], { id: string }[], Bundle]>(
      await Promise.all(mixedPromises)
    );

    console.log(
      `Fetched ${inactiveRoleMembers.length} Inactive and ${providerRoleMembers.length} Provider role members.`,
    );
    const inactiveMemberIds = inactiveRoleMembers.map((member: { id: string }) => member.id);
    const providerMemberIds = providerRoleMembers.map((member: { id: string }) => member.id);

    const recentlyActivePractitioners: string[] = Array.from(
      new Set<string>([
        ...extractParticipantsFromBunle(<Bundle>fhirBundle.entry![1].resource!),
        ...extractParticipantsFromBunle(<Bundle>fhirBundle.entry![2].resource!),
      ]),
    );

    console.log('recentlyActivePractitioners.length:', recentlyActivePractitioners.length);

    const employeeDetails: EmployeeDetails[] = allEmployees.map((employee) => {
      const status = inactiveMemberIds.includes(employee.id) ? 'Deactivated' : 'Active';
      const practitionerId = employee.profile.split('/')[1];
      const bundle = <Bundle>fhirBundle.entry![0].resource;
      const practitioner = bundle.entry!.find(
        (entry: any) => entry.resource?.resourceType === 'Practitioner' && entry.resource.id === practitionerId,
      )?.resource as Practitioner | undefined;

      const phone = practitioner?.telecom?.find((telecom) => telecom.system === 'phone')?.value;

      let licenses: PractitionerLicense[] = [];
      if (practitioner?.qualification) {
        licenses = practitioner.qualification.map((qualification: any) =>
          // Use direct mapping same as in get-user lambda, without checking for extension.urls.
          ({
            state: qualification.extension[0].extension[1].valueCodeableConcept.coding[0].code,
            code: qualification.code.coding[0].code,
            active: qualification.extension[0].extension[0].valueCode === 'active',
          }),
        );
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
      };
    });

    const response: GetEmployeesResponse = {
      message: `Successfully retrieved employee details`,
      employees: <EmployeeDetails[]>employeeDetails,
    };

    return lambdaResponse(200, response);
  } catch (error: any) {
    await topLevelCatch('admin-get-employee-details', error, input.secrets);
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, error.message);
  }
};

async function getEmployees(zapehrToken: string, secrets: Secrets | null): Promise<User[]> {
  console.log('Getting all employees..');
  const appClient = createAppClient(zapehrToken, secrets);
  const allEmployees = (await appClient.getAllUsers()).filter(
    (user) => !user.name.startsWith('+') && user.profile.includes('Practitioner'),
  );
  return allEmployees;
}

async function getRoles(zapehrToken: string, secrets: Secrets | null): Promise<any[]> {
  console.log('Getting roles...');
  const PROJECT_API = getSecret('PROJECT_API', secrets);
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${zapehrToken}`,
  };

  const existingRolesResponse = await fetch(`${PROJECT_API}/iam/role`, {
    method: 'GET',
    headers: headers,
  });
  if (!existingRolesResponse.ok) {
    console.log('Error searching for existing roles', await existingRolesResponse.json());
    throw new Error('Error searching for existing roles');
  }
  return existingRolesResponse.json();
}

export async function getRoleMembers(
  roleId: string,
  zapehrToken: string,
  secrets: Secrets | null,
): Promise<{ id: string }[]> {
  const PROJECT_API = getSecret('PROJECT_API', secrets);
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${zapehrToken}`,
  };

  let cursor = '';
  let page = 0;
  const COUNT = 100;
  const members = [];

  console.log(`search limit: ${COUNT}`);

  do {
    const response = await fetch(
      `${PROJECT_API}/user/v2/list?limit=${COUNT}&sort=name&cursor=${cursor}&roleId=${roleId}`,
      {
        method: 'GET',
        headers: headers,
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to get role.id=${roleId} members at ${cursor ? `page ${page} with cursor ${cursor}` : `page ${page}`}.`,
      );
    }
    const responseJSON = await response.json();
    members.push(...responseJSON.data);
    cursor = responseJSON.metadata.nextCursor;
    page += 1;
  } while (cursor !== null);

  return members;
}

function extractParticipantsFromBunle(bundle: Bundle): string[] {
  // Set will take care of values being unique.
  const participantSet =
    bundle.entry?.reduce((set: Set<string>, entry: any) => {
      const participants = entry.resource?.participant ?? [];
      participants.forEach((participant: any) => set.add(participant.individual?.reference));
      return set;
    }, new Set<string>()) ?? new Set<string>();

  return Array.from(participantSet).filter((participant) => participant.match(/^Practitioner\//) !== null);
}
