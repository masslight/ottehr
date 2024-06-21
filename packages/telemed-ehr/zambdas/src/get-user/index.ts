import { APIGatewayProxyResult } from 'aws-lambda';
import { PractitionerLicense, Secrets } from 'ehr-utils';
import { checkOrCreateM2MClientToken, createAppClient, createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetUserInput {
  secrets: Secrets | null;
  userId: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, userId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const fhirClient = createFhirClient(m2mtoken, secrets);
    const appClient = createAppClient(m2mtoken, secrets);
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
          profileResource: existingPractitionerResource,
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
