import { APIGatewayProxyResult } from 'aws-lambda';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, patchWithOptimisticLock } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getEmCodes, getEmCodesFhirResources } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('update-em-code', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  const { code, display } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const { valueSet } = await getEmCodesFhirResources(oystehr);

  await patchWithOptimisticLock(oystehr, valueSet, (freshValueSet) => {
    const contains = freshValueSet.expansion?.contains ?? [];
    const index = contains.findIndex((entry) => entry.code === code);
    if (index === -1) {
      throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`E&M code '${code}' not found`);
    }

    return [
      {
        op: 'replace',
        path: `/expansion/contains/${index}/display`,
        value: display,
      },
    ];
  });

  const updatedCodes = await getEmCodes(oystehr);
  return { statusCode: 200, body: JSON.stringify({ updatedCodes }) };
});
