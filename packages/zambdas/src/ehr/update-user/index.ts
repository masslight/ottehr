import { APIGatewayProxyResult } from 'aws-lambda';
import { HumanName, Practitioner } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI, PractitionerLicense, RoleType } from 'utils';
import { getSecret, Secrets } from 'zambda-utils';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { makeQualificationForPractitioner } from '../shared/practitioners';
import { getRoleId } from '../shared/rolesUtils';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';

export interface UpdateUserInput {
  secrets: Secrets | null;
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nameSuffix?: string;
  selectedRoles?: RoleType[];
  licenses?: PractitionerLicense[];
  phoneNumber?: string;
  npi?: string;
}

let m2mtoken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.log('validatedParameters:', JSON.stringify(validatedParameters, null, 4));
    const { secrets, userId, firstName, middleName, lastName, nameSuffix, selectedRoles, licenses, phoneNumber, npi } =
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
    const oystehr = createOystehrClient(m2mtoken, secrets);
    const user = await oystehr.user.get({ id: userId });
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
        existingPractitionerResource = <Practitioner>await oystehr.fhir.get({
          resourceType: 'Practitioner',
          id: practitionerId,
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
        await oystehr.fhir.create({
          resourceType: 'Practitioner',
          id: practitionerId,
          name: name ? [name] : undefined,
          qualification: practitionerQualificationExtension,
          telecom: phoneNumber ? [{ system: 'sms', value: phoneNumber }] : undefined,
        });
      } else {
        const existingTelecom = existingPractitionerResource.telecom || [];
        const smsIndex = existingTelecom.findIndex((tel) => tel.system === 'sms');
        const updatedTelecom = [...existingTelecom];
        if (phoneNumber) {
          if (smsIndex >= 0) {
            updatedTelecom[smsIndex] = { system: 'sms', value: phoneNumber };
          } else {
            updatedTelecom.push({ system: 'sms', value: phoneNumber });
          }
        }
        if (npi) {
          if (!existingPractitionerResource.identifier) {
            existingPractitionerResource.identifier = [];
          }
          const npiIndex = existingPractitionerResource.identifier.findIndex((id) => id.system === FHIR_IDENTIFIER_NPI);
          if (npiIndex >= 0) {
            existingPractitionerResource.identifier[npiIndex].value = npi;
          } else {
            existingPractitionerResource.identifier.push({
              system: FHIR_IDENTIFIER_NPI,
              value: npi,
            });
          }
        }
        await oystehr.fhir.update({
          ...existingPractitionerResource,
          identifier: existingPractitionerResource.identifier,
          photo: existingPractitionerResource.photo,
          name: name ? [name] : undefined,
          qualification: practitionerQualificationExtension,
          telecom: updatedTelecom,
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
