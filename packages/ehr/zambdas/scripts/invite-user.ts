import fetch from 'node-fetch';
import { Practitioner } from 'fhir/r4';
import { MANAGER_RULES } from '../src/shared';
import { RoleType } from '../src/shared/rolesUtils';

const DEFAULTS = {
  firstName: 'Example',
  lastName: 'Doctor',
};

async function createRole(projectApiUrl: string, accessToken: string, projectId: string): Promise<{ id: string }> {
  console.log('building access policies');
  const zambdaRule = {
    resource: ['Zambda:Function:*'],
    action: ['Zambda:InvokeFunction'],
    effect: 'Allow',
  };

  const managerAccessPolicy = { rule: [...MANAGER_RULES, zambdaRule] };

  const response = await fetch(`${projectApiUrl}/iam/role`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-zapehr-project-id': `${projectId}`,
    },
    body: JSON.stringify({
      name: RoleType.Manager,
      accessPolicy: managerAccessPolicy,
    }),
  });

  if (!response.ok) {
    const body = await response.json();
    if (body.code === '4006') {
      console.log('Role already exists. Fetching all roles...');

      const getResponse = await fetch(`${projectApiUrl}/iam/role`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'x-zapehr-project-id': `${projectId}`,
        },
      });

      const roles = await getResponse.json();
      return roles.find((r: any) => r.name === RoleType.Manager);
    }
    else {
      console.log(body);
      throw new Error('Failed to create a role.');
    }
  }

  const role = await response.json();
  return role;
}

export async function inviteUser(
  projectApiUrl: string,
  email: string,
  firstName = DEFAULTS.firstName,
  lastName = DEFAULTS.lastName,
  applicationId: string,
  accessToken: string,
  projectId: string
): Promise<string> {
  const role = await createRole(projectApiUrl, accessToken, projectId);

  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    active: true,
    name: [{ family: lastName, given: [firstName] }],
    telecom: [
      {
        system: 'email',
        value: email,
      },
    ],
  };

  const invitedUserResponse = await fetch(`${projectApiUrl}/user/invite`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-zapehr-project-id': `${projectId}`,
    },
    body: JSON.stringify({
      email: email,
      applicationId: applicationId,
      resource: practitioner,
      roles: [
        role.id
      ]
    }),
  });

  if (!invitedUserResponse.ok) {
    console.log(await invitedUserResponse.json());
    throw new Error('Failed to create user');
  }

  const invitedUser = await invitedUserResponse.json();
  return invitedUser.invitationUrl;
}
