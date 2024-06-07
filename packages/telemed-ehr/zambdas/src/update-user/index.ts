import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner, HumanName } from 'fhir/r4';
import { PractitionerLicense, Secrets } from 'ehr-utils';
import { RoleType } from '../../../app/src/types/types';
import { getSecret } from '../shared';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken, createAppClient, createFhirClient } from '../shared/helpers';
import { getRoleId } from '../shared/rolesUtils';
import { ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';
import { makeQualificationForPractitioner } from '../shared/practitioners';

export interface UpdateUserInput {
  secrets: Secrets | null;
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nameSuffix?: string;
  selectedRoles?: RoleType[];
  licenses?: PractitionerLicense[];
}

let m2mtoken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.log('validatedParameters:', JSON.stringify(validatedParameters, null, 4));
    const { secrets, userId, firstName, middleName, lastName, nameSuffix, selectedRoles, licenses } =
      validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const PROJECT_API = getSecret('PROJECT_API', secrets);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${m2mtoken}`,
    };
    const appClient = createAppClient(m2mtoken, secrets);
    const fhirClient = createFhirClient(m2mtoken, secrets);
    const user = await appClient.getUser(userId);
    const userProfile = user.profile;
    const userProfileString = userProfile.split('/');

    const practitionerId = userProfileString[1];
    // Update user's zapEHR roles
    // calling update user on an inactive user, reactivates them
    let roles: string[] = [];

    if (selectedRoles && selectedRoles.length > 0) {
      const promises = selectedRoles
        .filter((roleName) => roleName !== 'Inactive')
        .map((roleName) => getRoleId(roleName, m2mtoken, PROJECT_API));
      roles = await Promise.all(promises);
    }
    const updatedUserResponse = await fetch(`${PROJECT_API}/user/${userId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        roles: roles,
      }),
    });
    try {
      const practitionerQualificationExtension: any = [];
      licenses?.forEach((license) => {
        practitionerQualificationExtension.push(makeQualificationForPractitioner(license));
      });
      let existingPractitionerResource: Practitioner | null = null;
      try {
        existingPractitionerResource = <Practitioner>await fhirClient.readResource({
          resourceType: 'Practitioner',
          resourceId: practitionerId,
        });
      } catch (error: any) {
        if (
          error.resourceType === 'OperationOutcome' &&
          error.issue &&
          error.issue.some((issue: any) => issue.severity === 'error' && issue.code === 'not-found')
        ) {
          existingPractitionerResource = null;
        } else {
          throw new Error(`Failed to get Practitioner: ${JSON.stringify(error)}`);
        }
      }

      let name: HumanName | undefined = {};
      if (firstName) name.given = [firstName];
      if (middleName) (name.given ??= []).push(middleName);
      if (lastName) name.family = lastName;
      if (nameSuffix) name.suffix = [nameSuffix];
      if (Object.keys(name).length === 0) name = undefined;

      if (!existingPractitionerResource) {
        await fhirClient.createResource({
          resourceType: 'Practitioner',
          id: practitionerId,
          name: name ? [name] : undefined,
          qualification: practitionerQualificationExtension,
        });
      } else {
        await fhirClient.updateResource({
          ...existingPractitionerResource,
          identifier: existingPractitionerResource.identifier,
          photo: existingPractitionerResource.photo,
          name: name ? [name] : undefined,
          qualification: practitionerQualificationExtension,
        });
      }
    } catch (error: unknown) {
      throw new Error(`Failed to update Practitioner: ${JSON.stringify(error)}`);
    }
    console.log(await updatedUserResponse.json());
    if (!updatedUserResponse.ok) {
      throw new Error('Failed to update user');
    }
    const response = {
      message: `Successfully updated user ${userId}`,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('admin-update-user', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
