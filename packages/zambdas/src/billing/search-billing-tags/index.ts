import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { BillingTag } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, TAG_CODE_SYSTEM, TAG_DESCRIPTION_URL } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'search-billing-tags';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createBillingClient(m2mToken, input.secrets);

  const bundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [
      { name: 'code', value: `${TAG_CODE_SYSTEM}|tag` },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '200' },
    ],
  });

  const tags: BillingTag[] = bundle.unbundle().map((b) => ({
    id: b.id ?? '',
    name: b.code?.text ?? '',
    description: b.extension?.find((e) => e.url === TAG_DESCRIPTION_URL)?.valueString ?? '',
  }));

  return { statusCode: 200, body: JSON.stringify({ tags }) };
});
