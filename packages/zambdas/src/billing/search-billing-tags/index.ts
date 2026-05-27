import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, Claim } from 'fhir/r4b';
import { BillingTag } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CLAIM_TAG_SYSTEM, createBillingClient, TAG_CODE_SYSTEM, TAG_DESCRIPTION_URL } from '../shared';

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

  const basics = bundle.unbundle();
  const tags: BillingTag[] = await Promise.all(basics.map((b) => mapTag(oystehr, b)));

  return { statusCode: 200, body: JSON.stringify({ tags }) };
});

async function mapTag(oystehr: Oystehr, b: Basic): Promise<BillingTag> {
  const name = b.code?.text ?? '';
  let usage = 0;

  if (name) {
    const countBundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_tag', value: `${CLAIM_TAG_SYSTEM}|${name}` },
        { name: '_count', value: '0' },
      ],
    });
    usage = countBundle.total ?? 0;
  }

  return {
    id: b.id ?? '',
    name,
    description: b.extension?.find((e) => e.url === TAG_DESCRIPTION_URL)?.valueString ?? '',
    usage,
    updatedAt: b.meta?.lastUpdated ?? '',
  };
}
