import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, Claim } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { CLAIM_TAG_SYSTEM, createBillingClient, isSystemTag, TAG_CODE_SYSTEM } from '../shared';
import { DeleteBillingTagParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'delete-billing-tag';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: DeleteBillingTagParams): Promise<{ deleted: true }> {
  const tagBundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [
      { name: '_id', value: params.tagId },
      { name: 'code', value: `${TAG_CODE_SYSTEM}|tag` },
    ],
  });
  const tag = tagBundle.unbundle()[0];
  if (!tag) throw FHIR_RESOURCE_NOT_FOUND('Basic');
  if (isSystemTag(tag)) {
    throw INVALID_INPUT_ERROR('Cannot delete system-level tags');
  }

  const tagName = tag.code?.text ?? '';
  if (tagName) {
    const claimBundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_tag', value: `${CLAIM_TAG_SYSTEM}|${tagName}` },
        { name: '_total', value: 'accurate' },
        { name: '_count', value: '0' },
      ],
    });
    if (claimBundle.total === undefined) {
      throw INVALID_INPUT_ERROR('Unable to verify tag usage — FHIR server did not return a total count');
    }
    if (claimBundle.total > 0) {
      throw INVALID_INPUT_ERROR('Cannot delete tag — it is associated with one or more claims');
    }
  }

  await oystehr.fhir.delete({ resourceType: 'Basic', id: params.tagId });
  return { deleted: true };
}
