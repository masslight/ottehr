import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { GetReferralPdfOutput, REFERRAL_ROLES } from 'utils/lib/types/api/referrals/referrals.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { loadReferral } from '../../../shared/referrals/load-referral';
import { getOrCreateReferralForm, presignReferralForm } from '../../../shared/referrals/referral-form';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-referral-pdf';

let m2mToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { referralId, secrets } = validateRequestParameters(input);
    await requireUserWithRole(getUserToken(input), secrets, REFERRAL_ROLES);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const referral = await loadReferral(oystehr, referralId);
    const form = await getOrCreateReferralForm(referral, { oystehr, secrets, token: m2mToken });

    const output: GetReferralPdfOutput = {
      presignedURL: await presignReferralForm(form, m2mToken),
      documentReferenceId: form.documentReference.id ?? '',
    };
    return { statusCode: 200, body: JSON.stringify(output) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
