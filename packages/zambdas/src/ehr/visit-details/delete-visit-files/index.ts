import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { complexValidation, ValidatedInput, validateRequestParameters, validateSecrets } from './validation';

const ZAMBDA_NAME = 'delete-visit-files';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateSecrets');
    const secrets = validateSecrets(input.secrets);
    console.groupEnd();
    console.debug('validateSecrets success');

    console.group('validateRequestParameters');
    const validatedParameters = await validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));

    console.group('createOystehrClient');
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.groupEnd();
    console.debug('createOystehrClient success');

    console.group('complexValidation');
    const validatedInput = await complexValidation(validatedParameters, secrets, oystehr);
    console.groupEnd();
    console.debug('complexValidation success', JSON.stringify(validatedInput));

    console.group('performEffect');
    const success = await performEffect(validatedInput, oystehr);
    console.groupEnd();
    console.debug('performEffect success');

    return {
      statusCode: 200,
      body: JSON.stringify(success),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (input: ValidatedInput, oystehr: Oystehr): Promise<void> => {
  const { documentId } = input.body;

  await oystehr.fhir.patch({
    id: documentId,
    resourceType: 'DocumentReference',
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'superseded',
      },
    ],
  });
};
