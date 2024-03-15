import { APIGatewayProxyResult } from 'aws-lambda';
import { Resource } from 'fhir/r4';
import { PractitionerLicense, PractitionerQualificationCodesLabels } from 'ehr-utils';
import { RoleType } from '../../../app/src/types/types';
import { getAuth0Token, getSecret } from '../shared';
import { topLevelCatch } from '../shared/errors';
import { createAppClient, createFhirClient } from '../shared/helpers';
import { getRoleId } from '../shared/rolesUtils';
import { Secrets, ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';

export interface UpdateUserInput {
  secrets: Secrets | null;
  userId: string;
  selectedRole?: RoleType;
  licenses?: PractitionerLicense[];
}

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, userId, selectedRole, licenses } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const PROJECT_API = getSecret('PROJECT_API', secrets);
    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${zapehrToken}`,
    };
    const appClient = createAppClient(zapehrToken, secrets);
    const fhirClient = createFhirClient(zapehrToken, secrets);
    const user = await appClient.getUser(userId);
    const userProfile = user.profile;
    const userProfileString = userProfile.split('/');

    const practitionerId = userProfileString[1];
    // Update user's zapEHR roles
    // If there is a selectedRole, the user is currently active. Update their role to the selected one.
    // If there is no selectedRole, the user is currently deactivated. Re-activate them with zero roles.
    let roles: string[] = [];

    if (selectedRole) {
      const roleId = await getRoleId(selectedRole, zapehrToken, PROJECT_API);
      roles = [roleId];
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
        const qualificationEntry = {
          code: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7',
                code: license.code,
                display: PractitionerQualificationCodesLabels[license.code],
              },
            ],
            text: 'License state',
          },
          extension: [
            {
              url: 'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification',
              extension: [
                {
                  url: 'status',
                  valueCode: 'active',
                },
                {
                  url: 'whereValid',
                  valueCodeableConcept: {
                    coding: [
                      {
                        code: license.state,
                        system: 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        };
        practitionerQualificationExtension.push(qualificationEntry);
      });
      let existingPractitionerResource: Resource | null = null;
      try {
        existingPractitionerResource = await fhirClient.readResource({
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
      if (!existingPractitionerResource) {
        await fhirClient.createResource({
          resourceType: 'Practitioner',
          id: practitionerId,
          qualification: practitionerQualificationExtension,
        });
      } else {
        await fhirClient.updateResource({
          resourceType: 'Practitioner',
          id: practitionerId ?? '',
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
