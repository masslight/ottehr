import Oystehr, { RcmListPayersResponse } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, QuestionnaireItemAnswerOption } from 'fhir/r4b';
import {
  ANSWER_OPTION_FROM_RESOURCE_UNDEFINED,
  APIError,
  createOystehrClient,
  getPayerId,
  getSecret,
  isApiError,
  MISSING_REQUEST_SECRETS,
  SecretsKeys,
} from 'utils';
import { getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(
  'get-all-insurance-payers',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets } = input;
    if (!secrets) {
      throw MISSING_REQUEST_SECRETS;
    }

    console.group('getAuth0Token');
    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }
    console.groupEnd();
    console.debug('getAuth0Token success');

    console.group('createOystehrClient');
    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    console.groupEnd();
    console.debug('createOystehrClient success');

    const answerOptions: QuestionnaireItemAnswerOption[] = await getAllInsurancePayers(oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(answerOptions),
    };
  }
);

export async function getAllInsurancePayers(oystehr: Oystehr): Promise<QuestionnaireItemAnswerOption[]> {
  console.group('listPayers');
  const payers = [];
  let hasMore = true;
  let nextCursor: string | null = null;
  while (hasMore) {
    const result: RcmListPayersResponse = await oystehr.rcm.listPayers({ cursor: nextCursor ?? undefined });
    payers.push(...result.data);
    nextCursor = result.metadata.nextCursor;
    hasMore = !!nextCursor;
  }
  console.groupEnd();

  let error: APIError | undefined;
  const mappedResults = payers
    .map((payer) => {
      try {
        return formatPayerAsAnswerOption(oystehr, payer);
      } catch (e) {
        if (isApiError(e)) {
          error = e as APIError;
        }
        return undefined;
      }
    })
    .filter((res) => !!res) as QuestionnaireItemAnswerOption[];
  if (mappedResults.length === 0 && error) {
    throw error;
  }
  return mappedResults.sort((r1, r2) => {
    const r1Val = r1.valueReference?.display?.split(' - ')[1] ?? r1.valueReference?.display ?? '';
    const r2Val = r2.valueReference?.display?.split(' - ')[1] ?? r2.valueReference?.display ?? '';

    return r1Val.localeCompare(r2Val);
  });
}

const formatPayerAsAnswerOption = (oystehr: Oystehr, payer: Organization): QuestionnaireItemAnswerOption => {
  let name = payer.alias?.[0] ?? payer.name;
  const payerId = getPayerId(payer);
  if (payerId) {
    name = `${payerId} - ${name}`;
  }
  if (name && payerId && typeof name === 'string' && typeof payerId === 'string') {
    return {
      valueReference: {
        reference: oystehr.rcm.constructPayerUrl({ id: payerId }),
        display: name,
        type: payer.name === 'Other' ? 'other' : undefined,
      },
    };
  }
  throw ANSWER_OPTION_FROM_RESOURCE_UNDEFINED('Organization');
};
