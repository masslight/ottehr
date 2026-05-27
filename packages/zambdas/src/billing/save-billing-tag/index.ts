import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, TAG_CODE_SYSTEM, TAG_DESCRIPTION_URL } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-tag';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  if (params.tagId) {
    const bundle = await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [{ name: '_id', value: params.tagId }],
    });
    const existing = bundle.unbundle()[0];
    if (!existing) throw FHIR_RESOURCE_NOT_FOUND('Basic');

    const otherExts = (existing.extension ?? []).filter((e) => e.url !== TAG_DESCRIPTION_URL);
    const updatedExts = params.description
      ? [...otherExts, { url: TAG_DESCRIPTION_URL, valueString: params.description }]
      : otherExts;

    await oystehr.fhir.patch({
      resourceType: 'Basic',
      id: params.tagId,
      operations: [
        { op: 'add', path: '/code/text', value: params.name },
        { op: 'add', path: '/extension', value: updatedExts },
      ],
    });
    return { statusCode: 200, body: JSON.stringify({ id: params.tagId }) };
  }

  const tag: Basic = {
    resourceType: 'Basic',
    code: { text: params.name, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
    extension: params.description ? [{ url: TAG_DESCRIPTION_URL, valueString: params.description }] : undefined,
  };
  const created = await oystehr.fhir.create<Basic>(tag);
  return { statusCode: 200, body: JSON.stringify({ id: created.id }) };
});
