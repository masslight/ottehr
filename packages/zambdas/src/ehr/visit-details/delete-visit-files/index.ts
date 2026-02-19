import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DeleteVisitFilesInput, FHIR_RESOURCE_NOT_FOUND, getSecret, Secrets, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'delete-visit-files';

let m2mToken: string;

interface Input extends DeleteVisitFilesInput {
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));

    console.group('createOystehrClient');
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.groupEnd();
    console.debug('createOystehrClient success');

    console.group('complexValidation');
    const validatedInput = await complexValidation(validatedParameters, oystehr);
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

const performEffect = async (input: Input, oystehr: Oystehr): Promise<void> => {
  const { documentId } = input;

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

const complexValidation = async (input: Input, oystehr: Oystehr): Promise<Input> => {
  const { documentId } = input;

  const documentReferences = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        {
          name: '_id',
          value: documentId,
        },
        {
          name: 'status',
          value: 'current',
        },
      ],
    })
  ).unbundle();

  if (!documentReferences || documentReferences.length !== 1 || !documentReferences[0].id) {
    throw FHIR_RESOURCE_NOT_FOUND('DocumentReference');
  }

  return input;
};
