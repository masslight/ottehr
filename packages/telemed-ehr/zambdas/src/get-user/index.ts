import { APIGatewayProxyResult } from 'aws-lambda';
import { PractitionerLicense } from 'ehr-utils';
import { getAuth0Token } from '../shared';
import { createAppClient, createFhirClient } from '../shared/helpers';
import { Secrets, ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetUserInput {
  secrets: Secrets | null;
  userId: string;
}

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, userId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const token = await getAuth0Token(secrets);
    const fhirClient = createFhirClient(token, secrets);
    const appClient = createAppClient(token, secrets);
    let response = null;
    try {
      const getUserResponse = await appClient.getUser(userId);
      let existingPractitionerResource: any = null;
      const userProfile = getUserResponse.profile;
      const userProfileString = userProfile.split('/');

      const practitionerId = userProfileString[1];
      try {
        existingPractitionerResource =
          (await fhirClient.readResource({
            resourceType: 'Practitioner',
            resourceId: practitionerId,
          })) ?? null;
        console.log(existingPractitionerResource);
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
      const allLicenses: Array<PractitionerLicense> = [];
      if (existingPractitionerResource?.qualification) {
        existingPractitionerResource?.qualification.forEach((qualification: any) => {
          const newLicense: PractitionerLicense = {
            state: qualification.extension[0].extension[1].valueCodeableConcept.coding[0].code,
            code: qualification.code.coding[0].code,
          };
          allLicenses.push(newLicense);
        });
      }

      response = {
        message: `Successfully got user ${userId}`,
        user: {
          ...getUserResponse,
          licenses: allLicenses ?? [],
        },
      };
    } catch (error: unknown) {
      throw new Error(`Failed to get User: ${JSON.stringify(error)}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
