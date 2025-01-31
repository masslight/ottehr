import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FhirResource, QuestionnaireItemAnswerOption } from 'fhir/r4b';
import {
  ANSWER_OPTION_FROM_RESOURCE_UNDEFINED,
  APIError,
  AnswerOptionSource,
  MALFORMED_GET_ANSWER_OPTIONS_INPUT,
  MISSING_REQUEST_BODY,
  createOystehrClient,
  isApiError,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { SecretsKeys, getSecret } from 'zambda-utils';
import { getAuth0Token } from '../shared';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets } = input;

    const getOptionsInput = validateInput(input);
    console.log('get options input:', getOptionsInput);

    console.group('getAuth0Token');
    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }
    console.groupEnd();
    console.debug('getAuth0Token success');

    console.group('createOystehrClient');
    const oystehr = createOystehrClient(
      zapehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    console.groupEnd();
    console.debug('createOystehrClient success');

    const answerOptions = await performEffect(getOptionsInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(answerOptions),
    };
  } catch (error: any) {
    console.log(error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<QuestionnaireItemAnswerOption[]> => {
  const { type } = input;
  if (type === 'query') {
    const { resourceType, query } = input.answerSource;
    const paramsObject = new URLSearchParams(query);
    const params: { name: string; value: string }[] = [];
    for (const [key, value] of paramsObject) {
      params.push({ name: key, value });
    }
    console.group('searchResources');
    const results = (
      await oystehr.fhir.search({
        resourceType,
        params,
      })
    ).unbundle();
    console.groupEnd();
    let error: APIError | undefined;
    const mappedResults = results
      .map((result) => {
        try {
          return formatQueryResult(result, resourceType);
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
      const r1Val = r1.valueReference?.display ?? '';
      const r2Val = r2.valueReference?.display ?? '';

      return r1Val.localeCompare(r2Val);
    });
  } else {
    // todo: value sets
    return [];
  }
};

const formatQueryResult = (result: any, resourceType: FhirResource['resourceType']): QuestionnaireItemAnswerOption => {
  if (result.name && result.id && typeof result.name === 'string' && typeof result.id === 'string') {
    return { valueReference: { reference: `${resourceType}/${result.id}`, display: result.name } };
  }
  throw ANSWER_OPTION_FROM_RESOURCE_UNDEFINED(resourceType);
};

type QueryInput = { answerSource: AnswerOptionSource; type: 'query' };
type CanonicalInput = { type: 'canonical'; url: string; version: string };
type EffectInput = QueryInput | CanonicalInput;
const validateInput = (input: ZambdaInput): EffectInput => {
  const { body } = input;
  if (!body) {
    throw MISSING_REQUEST_BODY;
  }
  const { answerSource, valueSet } = JSON.parse(body);
  if (answerSource) {
    const { resourceType, query } = answerSource;
    if (!resourceType) {
      throw MALFORMED_GET_ANSWER_OPTIONS_INPUT('"answerSource" must contain a "resourceType" property');
    }
    if (!query) {
      throw MALFORMED_GET_ANSWER_OPTIONS_INPUT('"answerSource" must contain a "query" property');
    }
    return { type: 'query', answerSource };
  } else if (valueSet) {
    const [url, version] = valueSet.split('|');
    if (!url || !version) {
      throw MALFORMED_GET_ANSWER_OPTIONS_INPUT('"valueSet" property must be a well-formed canonical URL');
    }
    return { type: 'canonical', url, version };
  } else {
    throw MALFORMED_GET_ANSWER_OPTIONS_INPUT('Request body must contain an "answerSource" or "valueSet" property');
  }
};
