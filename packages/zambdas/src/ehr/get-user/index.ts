import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner, Schedule } from 'fhir/r4b';
import { GetUserResponse, PractitionerLicense } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('get-user', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, userId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    let response: GetUserResponse | null = null;
    try {
      const getUserResponse = await oystehr.user.get({ id: userId });
      let existingPractitionerResource: Practitioner | undefined = undefined;
      let schedule: Schedule | undefined;
      const userProfile = getUserResponse.profile;
      const userProfileString = userProfile.split('/');

      const practitionerId = userProfileString[1];
      try {
        const [practitionerResource, scheduleSearch] = await Promise.all([
          oystehr.fhir.get<Practitioner>({
            resourceType: 'Practitioner',
            id: practitionerId,
          }),
          oystehr.fhir
            .search<Schedule>({
              resourceType: 'Schedule',
              params: [
                {
                  name: 'actor',
                  value: `Practitioner/${practitionerId}`,
                },
              ],
            })
            .then((bundle) => {
              const resources = bundle.unbundle();
              const schedule = resources.find((r) => r.resourceType === 'Schedule');
              return schedule;
            }),
        ]);
        existingPractitionerResource = practitionerResource;
        schedule = scheduleSearch;
        console.log('Existing practitioner: ' + JSON.stringify(existingPractitionerResource));
      } catch (error: any) {
        if (
          error.resourceType === 'OperationOutcome' &&
          error.issue &&
          error.issue.some((issue: any) => issue.severity === 'error' && issue.code === 'not-found')
        ) {
          existingPractitionerResource = undefined;
        } else {
          throw new Error(`Failed to get Practitioner: ${JSON.stringify(error)}`);
        }
      }
      const allLicenses: Array<PractitionerLicense> = [];
      console.log(existingPractitionerResource);
      if (existingPractitionerResource?.qualification) {
        existingPractitionerResource?.qualification.forEach((qualification: any) => {
          const newLicense: PractitionerLicense = {
            state: qualification.extension[0].extension[1].valueCodeableConcept.coding[0].code,
            code: qualification.code.coding[0].code,
            active: qualification.extension[0].extension[0].valueCode === 'active',
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
        userScheduleId: schedule?.id,
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
});
