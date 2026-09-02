import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { UpdateProgressNoteConfigInputValidated } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { getProgressNoteConfigPayload, saveProgressNoteConfig } from '../../../shared/progress-note-config';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
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

/**
 * The sign-review prompt is configured by Ottehr customer support on the practice's behalf, so
 * Administrators and Managers may submit this form but may not change that one field.
 *
 * Absent means "unchanged": older clients that omit the field can't wipe the stored prompt, and a
 * non-customer-support user round-tripping the value their form loaded stays a no-op. Only an
 * explicitly different value counts as an edit.
 */
export const assertSignReviewPromptChangeAllowed = (
  user: User,
  incomingPrompt: string | undefined,
  storedPrompt: string | undefined
): void => {
  if (incomingPrompt === undefined || incomingPrompt === storedPrompt) return;
  if (!user.roles?.some((role) => role.name === RoleType.CustomerSupport)) {
    throw NOT_AUTHORIZED;
  }
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

  const storedConfig = await getProgressNoteConfigPayload(oystehr);

  assertSignReviewPromptChangeAllowed(user, signReviewPrompt, storedConfig.signReviewPrompt);

  await saveProgressNoteConfig(oystehr, {
    mdmRequired,
    medicalDecisionDefaultText,
    pcpNoTypeDispositionDefaultText,
    anotherDispositionDefaultText,
    edDispositionDefaultText,
    vitalsUnitInputOrder,
    signReviewPrompt: signReviewPrompt ?? storedConfig.signReviewPrompt,
  });
};
