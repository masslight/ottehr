import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { QuestionnaireResponse } from 'fhir/r4b';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { complexValidation, EffectInput, validateRequestParameters, validateSecrets } from './validation';

const ZAMBDA_NAME = 'delete-visit-form';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(input.secrets);
  const validatedParameters = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const validatedInput = await complexValidation(validatedParameters, secrets, oystehr);

  await performEffect(validatedInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  };
});

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<void> => {
  const { questionnaireResponse } = input;

  if (questionnaireResponse.status === 'entered-in-error') return;

  await oystehr.fhir.patch<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    id: questionnaireResponse.id!,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'entered-in-error',
      },
    ],
  });
};
