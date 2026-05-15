import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { GetSupportDialogOutput, SUPPORT_DIALOG_BASIC_TAG, SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL } from 'utils';
import { createOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-public-support-dialog';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }
  const oystehr = createOystehrClient(oystehrToken, secrets);

  const basicSearch = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [{ name: '_tag', value: `${SUPPORT_DIALOG_BASIC_TAG.system}|${SUPPORT_DIALOG_BASIC_TAG.code}` }],
    })
  ).unbundle();

  const basic = basicSearch.find((r): r is Basic => r.resourceType === 'Basic');
  const bodyHtml = basic?.extension?.find((e) => e.url === SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL)?.valueString ?? '';

  const response: GetSupportDialogOutput = { bodyHtml };
  return { statusCode: 200, body: JSON.stringify(response) };
});
