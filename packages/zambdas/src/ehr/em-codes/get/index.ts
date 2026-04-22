import { APIGatewayProxyResult } from 'aws-lambda';
import { ValueSet } from 'fhir/r4b';
import { CPTCodeOption, EM_CODES_VALUE_SET_URL } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('get-em-codes', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const searchResult = await oystehr.fhir.search<ValueSet>({
    resourceType: 'ValueSet',
    params: [{ name: 'url', value: EM_CODES_VALUE_SET_URL }],
  });

  const valueSet = searchResult.entry?.[0]?.resource;
  const contains = valueSet?.expansion?.contains ?? [];

  const codes: CPTCodeOption[] = contains
    .filter((entry): entry is typeof entry & { code: string; display: string } => !!entry.code && !!entry.display)
    .map((entry) => ({ code: entry.code, display: entry.display }));

  return {
    statusCode: 200,
    body: JSON.stringify({ codes }),
  };
});
