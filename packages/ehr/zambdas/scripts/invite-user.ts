import { Practitioner } from 'fhir/r4b';
import {
  ADMINISTRATOR_RULES,
  INACTIVE_RULES,
  MANAGER_RULES,
  STAFF_RULES,
  PROVIDER_RULES,
  PRESCRIBER_RULES,
} from '../src/shared';
import { AllStatesValues, PractitionerLicense, TIMEZONE_EXTENSION_URL } from 'utils';
import { makeQualificationForPractitioner } from '../src/shared/practitioners';
import Oystehr, { AccessPolicy, Role, RoleListItem } from '@oystehr/sdk';

const DEFAULTS = {
  firstName: 'Example',
  lastName: 'Doctor',
  phone: '+12125551212',
  npi: '1234567890',
};
export const enum RoleType {
  NewUser = 'NewUser',
  Inactive = 'Inactive',
  Manager = 'Manager',
  FrontDesk = 'FrontDesk',
  Staff = 'Staff',
  Provider = 'Provider',
  Prescriber = 'Prescriber',
  Administrator = 'Administrator',
}

const updateUserRoles = async (oystehr: Oystehr): Promise<{ id: string }[]> => {
  console.log('Updating user roles.');

  const zambdaRules: AccessPolicy['rule'] = [
    {
      resource: ['Zambda:Function:*'],
      action: ['Zambda:InvokeFunction'],
      effect: 'Allow',
    },
  ];
  const inactiveAccessPolicy = { rule: [...INACTIVE_RULES.rule, ...zambdaRules] };
  const administratorAccessPolicy = { rule: [...ADMINISTRATOR_RULES.rule, ...zambdaRules] };
  const managerAccessPolicy = { rule: [...MANAGER_RULES.rule, ...zambdaRules] };
  const staffAccessPolicy = { rule: [...STAFF_RULES.rule, ...zambdaRules] };
  const providerAccessPolicy = { rule: [...PROVIDER_RULES.rule, ...zambdaRules] };
  const prescriberAccessPolicy = { rule: [...PRESCRIBER_RULES, ...zambdaRules] };

  const roles = [
    { name: RoleType.Inactive, accessPolicy: inactiveAccessPolicy },
    { name: RoleType.Administrator, accessPolicy: administratorAccessPolicy },
    { name: RoleType.Manager, accessPolicy: managerAccessPolicy },
    { name: RoleType.Staff, accessPolicy: staffAccessPolicy },
    { name: RoleType.Provider, accessPolicy: providerAccessPolicy },
    { name: RoleType.Prescriber, accessPolicy: prescriberAccessPolicy },
  ];

  console.log('searching for existing roles for the project');
  let existingRoles: RoleListItem[];
  try {
    existingRoles = await oystehr.role.list();
  } catch (err) {
    throw new Error('Error searching for existing roles');
  }
  console.log('existingRoles: ', existingRoles);

  let adminUserRole = undefined;
  let prescriberUserRole = undefined;
  let providerUserRole = undefined;
  let managerUserRole = undefined;

  for (const role of roles) {
    const roleName = role.name;
    let foundRole;
    if (existingRoles.length > 0) {
      foundRole = existingRoles.find((existingRole: any) => existingRole.name === roleName);
    }
    let roleResult: Role;
    if (foundRole) {
      console.log(`${roleName} role found: `, foundRole);
      try {
        roleResult = await oystehr.role.update({
          roleId: foundRole.id,
          accessPolicy: role.accessPolicy as AccessPolicy,
        });
        console.log(`${roleName} role accessPolicy patched: `, roleResult, JSON.stringify(roleResult.accessPolicy));
      } catch (err) {
        console.error(err);
        throw new Error(`Failed to patch role ${roleName}`);
      }
    } else {
      console.log(`creating ${roleName} role`);
      try {
        roleResult = await oystehr.role.create({ name: roleName, accessPolicy: role.accessPolicy as AccessPolicy });
        console.log(`${roleName} role: `, roleResult, JSON.stringify(roleResult.accessPolicy));
      } catch (err) {
        console.error(err);
        throw new Error(`Failed to create role ${roleName}`);
      }
    }

    if (roleResult.name === RoleType.Administrator) {
      adminUserRole = roleResult;
    }
    if (roleResult.name === RoleType.Prescriber) {
      prescriberUserRole = roleResult;
    }
    if (roleResult.name === RoleType.Provider) {
      providerUserRole = roleResult;
    }
    if (roleResult.name === RoleType.Manager) {
      managerUserRole = roleResult;
    }
  }

  // console.group(`Setting defaultSSOUserRole for project to Administrator user role ${adminUserRole.id}`);
  // const endpoint = `${projectApiUrl}/project`;
  // const response = await fetch(endpoint, {
  //   method: 'PATCH',
  //   headers: httpHeaders,
  //   body: JSON.stringify({ defaultSSOUserRoleId: adminUserRole.id }),
  // });
  // const responseJSON = await response.json();
  // console.log('response', responseJSON);
  // if (!response.ok) {
  // throw new Error(`Failed to set defaultSSOUserRole`);
  // }

  if (!adminUserRole) {
    throw new Error('Could not create adminUserRole');
  }
  if (!prescriberUserRole) {
    throw new Error('Could not create adminUserRole');
  }
  if (!providerUserRole) {
    throw new Error('Could not create adminUserRole');
  }
  if (!managerUserRole) {
    throw new Error('Could not create adminUserRole');
  }
  return [adminUserRole, prescriberUserRole, providerUserRole, managerUserRole];
};

export async function inviteUser(
  oystehr: Oystehr,
  email: string,
  firstName = DEFAULTS.firstName,
  lastName = DEFAULTS.lastName,
  applicationId: string,
  includeDefaultSchedule?: boolean,
  slug?: string
): Promise<{ invitationUrl: string | undefined; userId: string | undefined }> {
  const defaultRoles = await updateUserRoles(oystehr);

  const practitionerQualificationExtension: any = [];
  (
    AllStatesValues.map(
      (state) => ({ state, code: 'MD', active: true }) as PractitionerLicense
    ) as PractitionerLicense[]
  ).forEach((license) => {
    practitionerQualificationExtension.push(makeQualificationForPractitioner(license));
  });

  const practitioner: Practitioner = {
    resourceType: 'Practitioner',
    active: true,
    identifier: [
      {
        use: 'official',
        value: DEFAULTS.npi,
        system: 'http://hl7.org/fhir/sid/us-npi',
      },
      { system: 'https://fhir.ottehr.com/r4/slug', value: slug },
    ],
    name: [{ family: lastName, given: [firstName] }],
    telecom: [
      {
        system: 'email',
        value: email,
      },
      {
        use: 'mobile',
        value: DEFAULTS.phone,
        system: 'sms',
      },
    ],
    qualification: practitionerQualificationExtension,
  };

  if (includeDefaultSchedule) {
    practitioner.extension = [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
        valueString:
          '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}',
      },
      {
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      },
    ];
  }

  const activeUsers = [];
  let activeUsersCursor;
  do {
    const usersPage = await oystehr.user.listV2({});
    activeUsers.push(...usersPage.data);
    activeUsersCursor = usersPage.metadata.nextCursor;
  } while (activeUsersCursor);

  if (activeUsers.find((user: any) => user.email === email)) {
    console.log('User is already invited to project');
    return { invitationUrl: undefined, userId: undefined };
  } else {
    console.log('Inviting user to project');
    try {
      const invitedUser = await oystehr.user.invite({
        email: email,
        applicationId: applicationId,
        resource: practitioner,
        roles: defaultRoles.map((role) => role.id),
      });
      console.log('User invited:', invitedUser);
      return { invitationUrl: invitedUser.invitationUrl, userId: invitedUser.profile.split('/')[1] };
    } catch (err) {
      console.error(err);
      throw new Error('Failed to create user');
    }
  }
}
