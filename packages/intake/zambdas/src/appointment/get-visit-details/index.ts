import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getEncounterForAppointment, GetVisitDetailsResponse } from 'utils';
import { ZambdaInput } from 'zambda-utils';

import { getSecret, SecretsKeys } from 'zambda-utils';
import { checkOrCreateM2MClientToken } from '../../shared';
import { getMedications, getPaymentDataRequest, getPresignedURLs } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    zapehrToken = await checkOrCreateM2MClientToken(zapehrToken, secrets);

    const oystehr = createOystehrClient(
      zapehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );

    let encounter = null;

    try {
      encounter = await getEncounterForAppointment(appointmentId, oystehr);
    } catch (error) {
      console.log('getEncounterForAppointment', error);
    }

    let paymentInfo = null;

    try {
      paymentInfo = await getPaymentDataRequest(
        getSecret(SecretsKeys.PROJECT_API, secrets),
        zapehrToken,
        encounter?.id
      );
    } catch (error) {
      console.log('getPaymentDataRequest', error);
    }

    let documents = null;

    try {
      console.log(`getting presigned urls for document references files at ${appointmentId}`);
      documents = await getPresignedURLs(oystehr, zapehrToken, encounter?.id);
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
