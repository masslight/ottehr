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
import {
  ADMIN_CONFIG_TAG_CODE,
  ADMIN_CONFIG_TAG_SYSTEM,
  ENABLED_AT_EXTENSION_URL,
  LAST_PROCESSED_EXTENSION_URL,
} from '../../shared/visit-feedback-constants';

const ZAMBDA_NAME = 'save-visit-feedback-config';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    if (!input.body) throw new Error('No request body provided');
    const { enabled, messageTemplate, delayHours } = JSON.parse(input.body);

    if (typeof enabled !== 'boolean') throw new Error('enabled must be a boolean');
    if (typeof messageTemplate !== 'string') throw new Error('messageTemplate must be a string');
    if (typeof delayHours !== 'number' || delayHours < 1) throw new Error('delayHours must be a positive number');
    if (enabled && !messageTemplate.trim()) throw new Error('messageTemplate is required when enabled');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);
    await saveConfig(oystehr, { enabled, messageTemplate, delayHours });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Visit feedback config saved' }),
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

async function saveConfig(oystehr: Oystehr, config: VisitFeedbackConfig): Promise<void> {
  const results = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [{ name: '_tag', value: `${ADMIN_CONFIG_TAG_SYSTEM}|${ADMIN_CONFIG_TAG_CODE}` }],
    })
  ).unbundle();

  const existing = results[0];
  const wasEnabled = existing?.status === 'active';
  const nowEnabled = config.enabled;

  // Determine enabledAt: set to now when toggling on, preserve when already on
  const existingEnabledAt = existing?.extension?.find((e) => e.url === ENABLED_AT_EXTENSION_URL)?.valueDateTime;
  const enabledAt = nowEnabled && !wasEnabled ? new Date().toISOString() : nowEnabled ? existingEnabledAt : undefined;

  // Preserve cursor from existing config
  const existingCursor = existing?.extension?.find((e) => e.url === LAST_PROCESSED_EXTENSION_URL)?.valueDateTime;

  const extensions = [];
  if (enabledAt) {
    extensions.push({ url: ENABLED_AT_EXTENSION_URL, valueDateTime: enabledAt });
  }
  // Reset cursor when re-enabling so it starts from enabledAt
  if (nowEnabled && !wasEnabled) {
    // Don't include cursor — cron will use enabledAt as start
  } else if (existingCursor) {
    extensions.push({ url: LAST_PROCESSED_EXTENSION_URL, valueDateTime: existingCursor });
  }

  const ad: ActivityDefinition = {
    resourceType: 'ActivityDefinition',
    status: config.enabled ? 'active' : 'draft',
    name: 'visit-feedback-config',
    title: 'Visit Feedback Configuration',
    description: config.messageTemplate,
    meta: {
      tag: [{ system: ADMIN_CONFIG_TAG_SYSTEM, code: ADMIN_CONFIG_TAG_CODE }],
    },
    timingDuration: {
      value: config.delayHours,
      unit: 'h',
      system: 'http://unitsofmeasure.org',
      code: 'h',
    },
    extension: extensions.length > 0 ? extensions : undefined,
  };

  if (existing) {
    ad.id = existing.id;
    await oystehr.fhir.update<ActivityDefinition>(ad);
    console.log(`Updated visit feedback config: ${ad.id}`);
  } else {
    const created = await oystehr.fhir.create<ActivityDefinition>(ad);
    console.log(`Created visit feedback config: ${created.id}`);
  }
}
