import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { GetSupportDialogOutput, SUPPORT_DIALOG_BASIC_TAG, SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-support-dialog';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const response = await getSupportDialogPayload(oystehr);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function getSupportDialogPayload(oystehr: Oystehr): Promise<GetSupportDialogOutput> {
  const basicSearch = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [{ name: '_tag', value: `${SUPPORT_DIALOG_BASIC_TAG.system}|${SUPPORT_DIALOG_BASIC_TAG.code}` }],
    })
  ).unbundle();

  const basic = basicSearch.find((r): r is Basic => r.resourceType === 'Basic');
  const bodyHtml = basic?.extension?.find((e) => e.url === SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL)?.valueString ?? '';

  return { bodyHtml };
}
