import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { UpdateProgressNoteConfigInputValidated } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import {
  findProgressNoteConfigBasic,
  progressNoteConfigPayloadFromBasic,
  saveProgressNoteConfig,
} from '../../../shared/progress-note-config';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { resolveSignReviewPrompt } from './helpers';
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
    const user = await complexValidation(validatedInput);
    console.groupEnd();
    console.debug('complexValidation success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    console.group('performEffect');
    await performEffect(validatedInput, oystehr, user);
    console.groupEnd();
    console.debug('performEffect success');

    return { statusCode: 204, body: '' };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const complexValidation = async (validatedInput: UpdateProgressNoteConfigInputValidated): Promise<User> => {
  const { userToken, secrets } = validatedInput;
  return requireUserWithRole(userToken, secrets, [RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport]);
};

const performEffect = async (
  validatedInput: UpdateProgressNoteConfigInputValidated,
  oystehr: Oystehr,
  user: User
): Promise<void> => {
  const {
    mdmRequired,
    medicalDecisionDefaultText,
    pcpNoTypeDispositionDefaultText,
    anotherDispositionDefaultText,
    edDispositionDefaultText,
    vitalsUnitInputOrder,
    signReviewPrompt,
  } = validatedInput;

  // One read backs both the sign-review-prompt check and the save's optimistic lock, so a prompt
  // change landing in between is reported as a conflict rather than silently reverted.
  const existingBasic = await findProgressNoteConfigBasic(oystehr);
  const storedConfig = progressNoteConfigPayloadFromBasic(existingBasic);

  await saveProgressNoteConfig(
    oystehr,
    {
      mdmRequired,
      medicalDecisionDefaultText,
      pcpNoTypeDispositionDefaultText,
      anotherDispositionDefaultText,
      edDispositionDefaultText,
      vitalsUnitInputOrder,
      signReviewPrompt: resolveSignReviewPrompt(user, signReviewPrompt, storedConfig.signReviewPrompt),
    },
    { existingBasic }
  );
};
