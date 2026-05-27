import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, Claim } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CLAIM_TAG_SYSTEM, createBillingClient, TAG_CODE_SYSTEM } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'delete-billing-tag';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const tagBundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [
      { name: '_id', value: params.tagId },
      { name: 'code', value: `${TAG_CODE_SYSTEM}|tag` },
    ],
  });
  const tag = tagBundle.unbundle()[0];
  if (!tag) throw FHIR_RESOURCE_NOT_FOUND('Basic');

  const tagName = tag.code?.text ?? '';
  if (tagName) {
    const claimBundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_tag', value: `${CLAIM_TAG_SYSTEM}|${tagName}` },
        { name: '_count', value: '1' },
      ],
    });
    if ((claimBundle.total ?? claimBundle.unbundle().length) > 0) {
      throw INVALID_INPUT_ERROR('Cannot delete tag — it is associated with one or more claims');
    }
  }

  await oystehr.fhir.delete({ resourceType: 'Basic', id: params.tagId });
  return { statusCode: 200, body: JSON.stringify({ deleted: true }) };
});
