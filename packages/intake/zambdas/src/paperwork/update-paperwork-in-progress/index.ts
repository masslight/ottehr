import Oystehr, { User } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Flag } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { topLevelCatch } from 'zambda-utils';
import '../../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token, getUser } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { createOrUpdateFlags } from '../sharedHelpers';
import { validateUpdatePaperworkParams } from './validateRequestParameters';

// Lifting the token out of the handler function allows it to persist across warm lambda invocations.
export let token: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('update-paperwork-in-progress', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const secrets = input.secrets;
    if (!token) {
      console.log('getting token');
      token = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const userToken = input.headers.Authorization?.replace('Bearer ', '');
    const user = userToken && (await getUser(userToken, input.secrets));
    const oystehr = createOystehrClient(token, secrets);

    console.group('validateRequestParameters');
    // Step 1: Validate input
    const { appointmentID, inProgress } = validateUpdatePaperworkParams(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    console.time('updating paperwork-in-progress flag');
    await flagPaperworkInProgress(appointmentID, inProgress, oystehr, user);
    console.timeEnd('updating paperwork-in-progress flag');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully updated appointment paperwork' }),
    };
  } catch (error: any) {
    return topLevelCatch('update-paperwork', error, input.secrets, captureSentryException);
  }
});

async function flagPaperworkInProgress(
  appointmentID: string,
  lastActive: string,
  oystehr: Oystehr,
  user: User | undefined
): Promise<void> {
  // get patient, encounter, and existing flags
  const resources = (
    await oystehr.fhir.search<Appointment | Encounter | Flag>({
      resourceType: 'Appointment',
      params: [
        {
          name: '_id',
          value: appointmentID,
        },
        {
          name: '_revinclude',
          value: 'Encounter:appointment',
        },
        {
          name: '_revinclude:iterate',
          value: 'Flag:encounter',
        },
        {
          name: '_elements',
          value: 'id, participant',
        },
      ],
    })
  ).unbundle();

  const appointment = resources.find((resource) => resource.resourceType === 'Appointment');
  const encounter = resources.find((resource) => resource.resourceType === 'Encounter');
  const existingFlags: Flag[] = (
    resources.filter(
      (resource) =>
        resource.resourceType === 'Flag' &&
        resource.meta?.tag?.find((tag) => tag.code === 'paperwork-in-progress') &&
        (resource as Flag).status === 'active'
    ) as Flag[]
  )
    // Sort by most recent first
    .sort((flagOne, flagTwo) => {
      const periodOne = DateTime.fromISO(flagOne.period?.start ?? '');
      const periodTwo = DateTime.fromISO(flagTwo.period?.start ?? '');
      return periodTwo.diff(periodOne).as('minutes');
    });
  const patientID = (appointment as Appointment).participant
    ?.find((participantTemp) => participantTemp.actor?.reference?.includes('Patient/'))
    ?.actor?.reference?.replace('Patient/', '');

  if (!encounter?.id || !patientID) {
    console.log('Skipping update to paperwork-in-progress flag. No IDs found for patient or encounter');
    return;
  }

  await createOrUpdateFlags('paperwork-in-progress', existingFlags, patientID, encounter.id, lastActive, oystehr, user);
}
