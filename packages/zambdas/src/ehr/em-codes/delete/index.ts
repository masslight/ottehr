import { APIGatewayProxyResult } from 'aws-lambda';
import { ValueSet } from 'fhir/r4b';
import { CPTCodeOption, DeleteEmCodeInput, EM_CODES_VALUE_SET_URL } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

let m2mToken: string;

export const index = wrapHandler('delete-em-code', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  const { code } = validateJsonBody(input) as DeleteEmCodeInput;

  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'code is required' }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const searchResult = await oystehr.fhir.search<ValueSet>({
    resourceType: 'ValueSet',
    params: [{ name: 'url', value: EM_CODES_VALUE_SET_URL }],
  });

  const valueSet = searchResult.entry?.[0]?.resource;
  if (!valueSet?.id) {
    return { statusCode: 404, body: JSON.stringify({ message: 'E&M codes ValueSet not found' }) };
  }

  const contains = valueSet.expansion?.contains ?? [];
  const index = contains.findIndex((entry) => entry.code === code);
  if (index === -1) {
    return { statusCode: 404, body: JSON.stringify({ message: `E&M code '${code}' not found` }) };
  }

  await oystehr.fhir.patch<ValueSet>({
    resourceType: 'ValueSet',
    id: valueSet.id,
    operations: [
      {
        op: 'remove',
        path: `/expansion/contains/${index}`,
      },
    ],
  });

  const updated = await oystehr.fhir.get<ValueSet>({ resourceType: 'ValueSet', id: valueSet.id });
  const codes: CPTCodeOption[] = (updated.expansion?.contains ?? [])
    .filter((entry): entry is typeof entry & { code: string; display: string } => !!entry.code && !!entry.display)
    .map((entry) => ({ code: entry.code, display: entry.display }));

  return { statusCode: 200, body: JSON.stringify({ codes }) };
});
