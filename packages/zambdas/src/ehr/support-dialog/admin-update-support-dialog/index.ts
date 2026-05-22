import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { SUPPORT_DIALOG_BASIC_TAG, SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  sanitizeSupportDialogHtml,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-support-dialog';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { secrets, bodyHtml } = validateRequestParameters(input);
  const cleanBodyHtml = sanitizeSupportDialogHtml(bodyHtml);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

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

  return { statusCode: 204, body: JSON.stringify({}) };
});
