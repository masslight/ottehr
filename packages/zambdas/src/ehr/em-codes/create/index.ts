import { APIGatewayProxyResult } from 'aws-lambda';
import { ValueSet } from 'fhir/r4b';
import { CPTCodeOption, EM_CODES_VALUE_SET_URL } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const CPT_SYSTEM = 'http://www.ama-assn.org/go/cpt';

let m2mToken: string;

export const index = wrapHandler('create-em-code', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  const { code, display } = validateRequestParameters(input);

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
  if (contains.some((entry) => entry.code === code)) {
    return { statusCode: 409, body: JSON.stringify({ message: `E&M code '${code}' already exists` }) };
  }

  await oystehr.fhir.patch<ValueSet>({
    resourceType: 'ValueSet',
    id: valueSet.id,
    operations: [
      {
        op: 'add',
        path: '/expansion/contains/-',
        value: { system: CPT_SYSTEM, code, display },
      },
    ],
  });

  const updated = await oystehr.fhir.get<ValueSet>({ resourceType: 'ValueSet', id: valueSet.id });
  const codes: CPTCodeOption[] = (updated.expansion?.contains ?? [])
    .filter((entry): entry is typeof entry & { code: string; display: string } => !!entry.code && !!entry.display)
    .map((entry) => ({ code: entry.code, display: entry.display }));

  return { statusCode: 200, body: JSON.stringify({ codes }) };
});
