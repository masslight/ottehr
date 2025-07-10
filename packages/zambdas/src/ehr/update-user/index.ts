import { APIGatewayProxyResult } from 'aws-lambda';
import { HumanName, Practitioner } from 'fhir/r4b';
import {
  FHIR_IDENTIFIER_NPI,
  getSecret,
  makeQualificationForPractitioner,
  SecretsKeys,
  UpdateUserZambdaOutput,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { getRoleId } from '../../shared/rolesUtils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.log('validatedParameters:', JSON.stringify(validatedParameters, null, 4));
    const {
      secrets,
      userId,
      firstName,
      middleName,
      lastName,
      nameSuffix,
      selectedRoles,
      licenses,
      phoneNumber,
      npi,
      birthDate,
      faxNumber,
      addressLine1,
      addressLine2,
      addressCity,
      addressState,
      addressZip,
    } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const PROJECT_API = getSecret('PROJECT_API', secrets);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${m2mToken}`,
    };
    const oystehr = createOystehrClient(m2mToken, secrets);
    const user = await oystehr.user.get({ id: userId });
    const userProfile = user.profile;
    const userProfileString = userProfile.split('/');

    const practitionerId = userProfileString[1];
    // Update user's Oystehr roles
    // calling update user on an inactive user, reactivates them
    let roles: string[] = [];

    if (selectedRoles && selectedRoles.length > 0) {
      const promises = selectedRoles
        .filter((roleName) => roleName !== 'Inactive')
        .map((roleName) => getRoleId(roleName, m2mToken, PROJECT_API));
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
          telecom: phoneNumber
            ? [
                { system: 'sms', value: phoneNumber },
                { system: 'phone', value: phoneNumber },
              ]
            : undefined,
        });
      } else {
        const existingTelecom = existingPractitionerResource.telecom || [];
        const smsIndex = existingTelecom.findIndex((tel) => tel.system === 'sms');
        const phoneIndex = existingTelecom.findIndex((tel) => tel.system === 'phone');
        const faxIndex = existingTelecom.findIndex((tel) => tel.system === 'fax');
        let updatedTelecom = [...existingTelecom];
        if (phoneNumber) {
          if (smsIndex >= 0) {
            updatedTelecom[smsIndex] = { system: 'sms', value: phoneNumber };
          } else {
            updatedTelecom.push({ system: 'sms', value: phoneNumber });
          }
          if (phoneIndex >= 0) {
            updatedTelecom[phoneIndex] = { system: 'phone', value: phoneNumber };
          } else {
            updatedTelecom.push({ system: 'phone', value: phoneNumber });
          }
        } else {
          updatedTelecom = updatedTelecom.filter((tel) => tel.system !== 'sms' && tel.system !== 'phone');
        }

        if (faxNumber) {
          if (faxIndex >= 0) {
            updatedTelecom[faxIndex] = { system: 'fax', value: faxNumber };
          } else {
            updatedTelecom.push({ system: 'fax', value: faxNumber });
          }
        } else {
          updatedTelecom = updatedTelecom.filter((tel) => tel.system !== 'fax');
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
        } else {
          if (existingPractitionerResource.identifier) {
            existingPractitionerResource.identifier = existingPractitionerResource.identifier.filter(
              (id) => id.system !== FHIR_IDENTIFIER_NPI
            );
          }
        }

        if (birthDate) {
          existingPractitionerResource.birthDate = birthDate;
        }

        const existingAddress = existingPractitionerResource.address || [];
        let workAddressIndex = existingAddress.findIndex((address) => address.use === 'work');
        let updatedAddress = [...existingAddress];
        // if any address fields are provided, add or update the work address
        if (addressCity || addressState || addressZip || addressLine1 || addressLine2) {
          if (workAddressIndex < 0) {
            updatedAddress.push({
              use: 'work',
            });
            workAddressIndex = updatedAddress.length - 1;
          }

          if (addressLine1) {
            updatedAddress[workAddressIndex].line = [addressLine1];
            if (addressLine2) {
              updatedAddress[workAddressIndex].line?.push(addressLine2);
            }
          }

          updatedAddress[workAddressIndex].city = addressCity || undefined;
          updatedAddress[workAddressIndex].state = addressState || undefined;
          updatedAddress[workAddressIndex].postalCode = addressZip || undefined;
        } else {
          // if no address fields are provided, remove the work address
          updatedAddress = updatedAddress.filter((address) => address.use !== 'work');
        }

        await oystehr.fhir.update({
          ...existingPractitionerResource,
          identifier:
            existingPractitionerResource.identifier?.length || 0 > 0
              ? existingPractitionerResource.identifier
              : undefined,
          photo: existingPractitionerResource.photo,
          name: name ? [name] : undefined,
          qualification: practitionerQualificationExtension,
          telecom: updatedTelecom.length > 0 ? updatedTelecom : undefined,
          address: updatedAddress.length > 0 ? updatedAddress : undefined,
          birthDate: birthDate ? birthDate : undefined,
        });
      }
    } catch (error: unknown) {
      throw new Error(`Failed to update Practitioner: ${JSON.stringify(error)}`);
    }
    console.log(await updatedUserResponse.json());
    if (!updatedUserResponse.ok) {
      throw new Error('Failed to update user');
    }
    const response: UpdateUserZambdaOutput = {
      message: `Successfully updated user ${userId}`,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-update-user', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
