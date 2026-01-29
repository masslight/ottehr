import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter } from 'fhir/r4b';
import {
  createOystehrClient,
  FileURLInfo,
  getSecret,
  GetVisitDetailsResponse,
  isFollowupEncounter,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { getMedications, getPresignedURLs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

const ZAMBDA_NAME = 'get-visit-details';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, secrets);

    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );

    let encounter = null;
    let appointmentTime = 'unknown date';
    let allEncounters: Encounter[] = [];

    try {
      const encounterResults = (
        await oystehr.fhir.search<Encounter | Appointment>({
          resourceType: 'Encounter',
          params: [
            {
              name: 'appointment',
              value: `Appointment/${appointmentId}`,
            },
            {
              name: '_include',
              value: 'Encounter:appointment',
            },
          ],
        })
      ).unbundle();
      allEncounters = encounterResults.filter((e) => e.resourceType === 'Encounter') as Encounter[];
      // Find the main encounter (not follow-up)
      encounter = allEncounters.find((e) => !isFollowupEncounter(e)) as Encounter;
      const appointment = encounterResults.find((e) => e.resourceType === 'Appointment') as Appointment;
      if (!encounter || !encounter.id) {
        throw new Error('Error getting appointment encounter');
      }
      appointmentTime = appointment?.start ?? encounter?.period?.start ?? 'unknown date';
    } catch (error) {
      captureException(error);
      console.log('getEncounterForAppointment', error);
    }

    let documents = null;
    let reviewedLabResults: FileURLInfo[] = [];

    try {
      console.log(`getting presigned urls for document references files at ${appointmentId}`);
      const { presignedUrls, reviewedLabResultsUrls } = await getPresignedURLs(oystehr, oystehrToken, encounter?.id);
      documents = presignedUrls;
      reviewedLabResults = reviewedLabResultsUrls;
    } catch (error) {
      console.log('getPresignedURLs', error);
      captureException(error);
    }

    let medications = null;

    try {
      medications = await getMedications(oystehr, encounter?.id);
    } catch (error) {
      captureException(error);
      console.log('getMedications', error);
    }

    let followUps: GetVisitDetailsResponse['followUps'] = [];

    try {
      if (encounter?.id) {
        const getEncounterSortValue = (encounterResource: Encounter): number => {
          const dateString = encounterResource.period?.start ?? encounterResource.period?.end;
          return dateString ? new Date(dateString).getTime() : Number.POSITIVE_INFINITY;
        };

        const sortedFollowups = allEncounters
          .filter((e) => isFollowupEncounter(e))
          .sort((a, b) => getEncounterSortValue(a) - getEncounterSortValue(b));

        followUps = await Promise.all(
          sortedFollowups.map(async (followupEncounter) => {
            let followupDocuments = {};
            try {
              if (followupEncounter.id) {
                // todo sarah do we need to add handling of lab result urls here too?
                const { presignedUrls } = await getPresignedURLs(oystehr, oystehrToken, followupEncounter.id);
                followupDocuments = presignedUrls;
              }
            } catch (error) {
              console.log('getPresignedURLs for follow-up', error);
              captureException(error);
            }

            const encounterTime = followupEncounter.period?.start ?? followupEncounter.period?.end ?? 'unknown date';

            return {
              encounterTime,
              documents: followupDocuments,
            };
          })
        );
      }
    } catch (error) {
      captureException(error);
      console.log('getFollowUpEncounters', error);
    }

    console.log('building get appointment response');
    const response: GetVisitDetailsResponse = {
      files: documents || {},
      medications: medications || [],
      appointmentTime,
      followUps,
      reviewedLabResults,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
