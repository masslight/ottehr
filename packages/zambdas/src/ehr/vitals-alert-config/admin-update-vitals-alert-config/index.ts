import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { RoleType } from 'utils/lib/types/api/user.types';
import { UpdateVitalsAlertConfigInputValidated } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getVitalsAlertConfigEngineError } from 'utils/lib/utils/vitals-alert-config';
import { checkOrCreateM2MClientToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { saveVitalsAlertConfig } from '../../../shared/vitals-alert-config';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-vitals-alert-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  try {
    console.group('validateRequestParameters');
    const validatedInput = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const { secrets } = validatedInput;

    console.group('complexValidation');
    await complexValidation(validatedInput);
    console.groupEnd();
    console.debug('complexValidation success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    console.group('performEffect');
    await performEffect(validatedInput, oystehr);
    console.groupEnd();
    console.debug('performEffect success');

    return { statusCode: 204, body: '' };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const complexValidation = async (validatedInput: UpdateVitalsAlertConfigInputValidated): Promise<void> => {
  const { userToken, secrets, config } = validatedInput;
  await requireUserWithRole(userToken, secrets, [RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport]);

  // Every read path adapts the stored config, so one the engine cannot load must not be stored.
  const engineError = getVitalsAlertConfigEngineError(config);
  if (engineError) {
    throw INVALID_INPUT_ERROR(engineError);
  }
};

const performEffect = async (
  validatedInput: UpdateVitalsAlertConfigInputValidated,
  oystehr: Oystehr
): Promise<void> => {
  await saveVitalsAlertConfig(oystehr, validatedInput.config);
};
