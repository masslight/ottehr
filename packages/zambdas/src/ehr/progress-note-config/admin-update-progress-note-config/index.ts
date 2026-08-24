import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { UpdateProgressNoteConfigInputValidated } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { RoleType } from 'utils/lib/types/api/user.types';
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

const complexValidation = async (validatedInput: UpdateProgressNoteConfigInputValidated): Promise<void> => {
  const { userToken, secrets } = validatedInput;
  await requireUserWithRole(userToken, secrets, [RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport]);
};

const performEffect = async (
  validatedInput: UpdateProgressNoteConfigInputValidated,
  oystehr: Oystehr
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
  await saveProgressNoteConfig(oystehr, {
    mdmRequired,
    medicalDecisionDefaultText,
    pcpNoTypeDispositionDefaultText,
    anotherDispositionDefaultText,
    edDispositionDefaultText,
    vitalsUnitInputOrder,
    // Absent means "unchanged" so older clients that omit the field can't wipe the stored
    // prompt; an explicit empty string is the deliberate clear.
    signReviewPrompt: signReviewPrompt ?? (await getProgressNoteConfigPayload(oystehr)).signReviewPrompt,
  });
};
