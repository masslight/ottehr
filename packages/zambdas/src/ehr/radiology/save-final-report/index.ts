import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets } from 'utils/lib/secrets';
import { SaveRadiologyReportZambdaOutput } from 'utils/lib/types/api/radiology';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { resolveCallerPractitionerRef } from '../../../shared/practitioners';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { finalizeRadiologyReport } from '../shared/finalize-report';
import { ValidatedInput, validateInput, validateSecrets } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'save-final-report';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const output = await performEffect(validatedInput, secrets, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({ output }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
});

async function performEffect(
  validatedInput: ValidatedInput,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<SaveRadiologyReportZambdaOutput> {
  const { serviceRequestId, report: finalReport } = validatedInput.body;

  const author = await resolveCallerPractitionerRef(validatedInput.callerAccessToken, secrets, oystehr);

  await finalizeRadiologyReport(serviceRequestId, finalReport, author, oystehr);

  return {};
}
