import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

const ZAMBDA_NAME = 'get-visit-feedback-config';

import { ADMIN_CONFIG_TAG_CODE, ADMIN_CONFIG_TAG_SYSTEM } from '../../shared/visit-feedback-constants';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);
    const config = await getConfig(oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(config),
    };
  } catch (error: any) {
    console.error('Error:', error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

interface VisitFeedbackConfig {
  enabled: boolean;
  messageTemplate: string;
  delayHours: number;
}

async function getConfig(oystehr: Oystehr): Promise<VisitFeedbackConfig> {
  const results = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [{ name: '_tag', value: `${ADMIN_CONFIG_TAG_SYSTEM}|${ADMIN_CONFIG_TAG_CODE}` }],
    })
  ).unbundle();

  if (results.length === 0) {
    return { enabled: false, messageTemplate: '', delayHours: 24 };
  }

  const ad = results[0];
  return {
    enabled: ad.status === 'active',
    messageTemplate: ad.description ?? '',
    delayHours: ad.timingDuration?.value ?? 24,
  };
}
