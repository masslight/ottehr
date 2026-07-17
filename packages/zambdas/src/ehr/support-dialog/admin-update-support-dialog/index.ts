import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import {
  AdminUpdateSupportDialogInput,
  getSecret,
  SecretsKeys,
  SUPPORT_DIALOG_BASIC_TAG,
  SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  sanitizeSupportDialogHtml,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-support-dialog';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  try {
    const validatedInput = validateRequestParameters(input);
    const { secrets } = validatedInput;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    await performEffect(validatedInput, oystehr);

    return { statusCode: 204, body: '' };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (validatedInput: AdminUpdateSupportDialogInput, oystehr: Oystehr): Promise<void> => {
  const { bodyHtml } = validatedInput;
  const cleanBodyHtml = sanitizeSupportDialogHtml(bodyHtml);

  const existing = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [{ name: '_tag', value: `${SUPPORT_DIALOG_BASIC_TAG.system}|${SUPPORT_DIALOG_BASIC_TAG.code}` }],
    })
  )
    .unbundle()
    .find((r): r is Basic => r.resourceType === 'Basic');

  const basicResource: Basic = {
    resourceType: 'Basic',
    meta: { tag: [SUPPORT_DIALOG_BASIC_TAG] },
    code: { coding: [SUPPORT_DIALOG_BASIC_TAG] },
    extension: [{ url: SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL, valueString: cleanBodyHtml }],
  };

  if (existing) {
    await oystehr.fhir.update<Basic>(
      { ...basicResource, id: existing.id! },
      existing.meta?.versionId ? { optimisticLockingVersionId: existing.meta.versionId } : undefined
    );
  } else {
    await oystehr.fhir.create<Basic>(basicResource);
  }
};
