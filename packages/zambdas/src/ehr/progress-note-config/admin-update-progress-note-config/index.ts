import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, RoleType, SecretsKeys, UpdateProgressNoteConfigInputValidated } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  requireUserWithRole,
  saveProgressNoteConfig,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-progress-note-config';

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
    const oystehr = createOystehrClient(m2mToken, secrets);

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

const complexValidation = async (validatedInput: UpdateProgressNoteConfigInputValidated): Promise<void> => {
  const { userToken, secrets } = validatedInput;
  await requireUserWithRole(userToken, secrets, [RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport]);
};

const performEffect = async (
  validatedInput: UpdateProgressNoteConfigInputValidated,
  oystehr: Oystehr
): Promise<void> => {
  const { mdmRequired } = validatedInput;
  await saveProgressNoteConfig(oystehr, { mdmRequired });
};
