import { APIGatewayProxyResult } from 'aws-lambda';
import {
  EmCodeOutput,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getEmCodes,
  getEmCodesFhirResources,
  patchWithOptimisticLock,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('delete-em-code', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  const { code } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const { valueSet } = await getEmCodesFhirResources(oystehr);

  await patchWithOptimisticLock(oystehr, valueSet, (freshValueSet) => {
    const contains = freshValueSet.expansion?.contains ?? [];
    const index = contains.findIndex((entry) => entry.code === code);
    if (index === -1) {
      throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`E&M code '${code}' not found`);
    }

    return [
      {
        op: 'remove',
        path: `/expansion/contains/${index}`,
      },
    ];
  });

  const updatedCodes = await getEmCodes(oystehr);
  const response: EmCodeOutput = {
    codes: updatedCodes,
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
