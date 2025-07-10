import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter } from 'fhir/r4b';
import { createOystehrClient, getSecret, GetVisitDetailsResponse, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, ZambdaInput } from '../../../shared';
import { getMedications, getPaymentDataRequest, getPresignedURLs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
      encounter = encounterResults.find((e) => e.resourceType === 'Encounter') as Encounter;
      const appointment = encounterResults.find((e) => e.resourceType === 'Appointment') as Appointment;
      if (!encounter || !encounter.id) {
        throw new Error('Error getting appointment encounter');
      }
      appointmentTime = appointment?.start ?? encounter?.period?.start ?? 'unknown date';
    } catch (error) {
      console.log('getEncounterForAppointment', error);
    }

    let paymentInfo = null;

    try {
      paymentInfo = await getPaymentDataRequest(
        getSecret(SecretsKeys.PROJECT_API, secrets),
        oystehrToken,
        encounter?.id
      );
    } catch (error) {
      console.log('getPaymentDataRequest', error);
    }

    let documents = null;

    try {
      console.log(`getting presigned urls for document references files at ${appointmentId}`);
      documents = await getPresignedURLs(oystehr, oystehrToken, encounter?.id);
    } catch (error) {
      console.log('getPresignedURLs', error);
    }

    let medications = null;

    try {
      medications = await getMedications(oystehr, encounter?.id);
    } catch (error) {
      console.log('getMedications', error);
    }

    console.log('building get appointment response');
    const response: GetVisitDetailsResponse = {
      files: documents || {},
      medications: medications || [],
      appointmentTime,
      charge: {
        amount: paymentInfo?.amount || NaN,
        currency: paymentInfo?.currency || '',
        date: paymentInfo?.date || '',
      },
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};
