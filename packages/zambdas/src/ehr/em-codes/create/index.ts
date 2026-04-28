import { APIGatewayProxyResult } from 'aws-lambda';
import { ALREADY_EXISTS_WITH_MESSAGE, CPT_CODE_SYSTEM, patchWithOptimisticLock } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getEmCodes, getEmCodesFhirResources } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('create-em-code', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  const { code, display } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const { valueSet } = await getEmCodesFhirResources(oystehr);

  console.log('version id: ', valueSet.meta?.versionId);
  valueSet.meta!.versionId = '123';
  console.log('version id: ', valueSet.meta?.versionId);

  await patchWithOptimisticLock(oystehr, valueSet, (freshValueSet) => {
    const contains = freshValueSet.expansion?.contains ?? [];
    if (contains.some((entry) => entry.code === code)) {
      throw ALREADY_EXISTS_WITH_MESSAGE(`E&M code '${code}' already exists`);
    }

    return [
      {
        op: 'add',
        path: '/expansion/contains/-',
        value: { system: CPT_CODE_SYSTEM, code, display },
      },
    ];
  });

  const updatedCodes = await getEmCodes(oystehr);
  return { statusCode: 200, body: JSON.stringify({ updatedCodes }) };
});
