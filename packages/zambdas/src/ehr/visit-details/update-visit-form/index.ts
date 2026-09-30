import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { buildFormAnswerPatchOperations } from './helpers';
import { complexValidation, EffectInput, validateRequestParameters, validateSecrets } from './validation';

const ZAMBDA_NAME = 'update-visit-form';

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
  const { pages } = input.body;

  await patchWithOptimisticLock(oystehr, { ...questionnaireResponse, id: questionnaireResponse.id! }, (current) => {
    if (current.status === 'entered-in-error') {
      throw INVALID_INPUT_ERROR('A form that has been deleted cannot be edited.');
    }
    return buildFormAnswerPatchOperations(current, pages);
  });
};
