import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import {
  AllStatesValues,
  makeQualificationForPractitioner,
  PractitionerLicense,
  RoleType,
  SCHEDULE_EXTENSION_URL,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { filterIdsOnlyToTheseRoles, updateUserRoles } from '../shared';

const DEFAULTS = {
  firstName: 'Example',
  lastName: 'Doctor',
  phone: '+12125551212',
  npi: '1234567890',
};

export async function inviteUser(
  oystehr: Oystehr,
  email: string,
  firstName = DEFAULTS.firstName,
  lastName = DEFAULTS.lastName,
  applicationId: string,
  includeDefaultSchedule?: boolean,
  slug?: string
): Promise<{ invitationUrl: string | undefined; userProfileId: string | undefined }> {
  const defaultRoleNames = [
    RoleType.Administrator,
    RoleType.CustomerSupport,
    RoleType.Manager,
    RoleType.Prescriber,
    RoleType.Provider,
  ];
  const allRoleIds = await updateUserRoles(oystehr);
  const defaultRoleIds = filterIdsOnlyToTheseRoles(allRoleIds, defaultRoleNames);

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
      { system: SLUG_SYSTEM, value: slug },
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
        url: SCHEDULE_EXTENSION_URL,
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
    return { invitationUrl: undefined, userProfileId: undefined };
  } else {
    console.log('Inviting user to project');
    try {
      const invitedUser = await oystehr.user.invite({
        email: email,
        applicationId: applicationId,
        resource: practitioner,
        roles: defaultRoleIds,
      });
      console.log('User invited:', invitedUser);
      return { invitationUrl: invitedUser.invitationUrl, userProfileId: invitedUser.profile.split('/')[1] };
    } catch (err) {
      console.error(err);
      throw new Error('Failed to create user');
    }
  }
}
