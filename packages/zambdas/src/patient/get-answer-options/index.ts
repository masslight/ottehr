import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BundleLink, FhirResource, QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { createOystehrClient } from 'utils/lib/helpers/helpers';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { ORG_TYPE_CODE_SYSTEM, ORG_TYPE_OCCUPATIONAL_MEDICINE_EMPLOYER_CODE } from 'utils/lib/types/constants';
import {
  ANSWER_OPTION_FROM_RESOURCE_UNDEFINED,
  APIError,
  isApiError,
  MALFORMED_GET_ANSWER_OPTIONS_INPUT,
  MISSING_REQUEST_BODY,
} from 'utils/lib/types/errors';
import { AnswerOptionSource } from '../../../../config-types/config/fhir';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { listNonInsuranceOrganizations } from '../../shared/nio-directory';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

const ZAMBDA_NAME = 'get-answer-options';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;

  const getOptionsInput = validateInput(input);
  console.log('get options input:', getOptionsInput);

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

  const answerOptions: QuestionnaireItemAnswerOption[] = await performEffect(getOptionsInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(answerOptions),
  };
});

export const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<QuestionnaireItemAnswerOption[]> => {
  const { type } = input;
  if (type === 'query' && input.answerSource.zambdaId === 'get-answer-options') {
    // In NIO mode the legacy occ-med employer query — recognized by its type token, since intake,
    // archived questionnaire versions, and the EHR patient record all send it verbatim — is
    // rerouted to the billing app's NIO directory. Options carry the NIO reference token, so
    // every downstream save stores tokens with no Questionnaire or config change.
    if (FEATURE_FLAGS_CONFIG.nonInsuranceOrganizationsEnabled && isOccMedEmployerQuery(input.answerSource)) {
      return listNioEmployerAnswerOptions(oystehr);
    }
    const { resourceType, query, prependedIdentifier } = input.answerSource;
    const paramsObject = new URLSearchParams(query);
    let offset = 0;
    const params = [
      {
        name: '_count',
        value: '1000',
      },
      {
        name: '_offset',
        value: offset,
      },
    ];
    for (const [key, value] of paramsObject) {
      params.push({ name: key, value });
    }
    console.group('searchResources');
    let results: any[] = [];

    console.group(params);

    let resources = await oystehr.fhir.search({
      resourceType,
      params,
    });

    results = results.concat(resources.unbundle());
    while ((resources.link as BundleLink[] | undefined)?.find((link) => link.relation === 'next')) {
      resources = await oystehr!.fhir.search({
        resourceType,
        params: params.map((param) => {
          if (param.name === '_offset') {
            return {
              ...param,
              value: (offset += 1000),
            };
          }
          return param;
        }),
      });
      results = results.concat(resources.unbundle());
    }

    console.groupEnd();

    let error: APIError | undefined;
    const mappedResults = results
      .map((result) => {
        try {
          return formatQueryResult(result, resourceType, prependedIdentifier);
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
  } else {
    // todo: value sets
    return [];
  }
};

const OCC_MED_EMPLOYER_QUERY_TOKEN = `${ORG_TYPE_CODE_SYSTEM}|${ORG_TYPE_OCCUPATIONAL_MEDICINE_EMPLOYER_CODE}`;

// Keyed on the query's type token only: the EHR sends an extra prependedIdentifier field that
// intake and archived questionnaires do not, so nothing else about the answerSource is stable
// across callers.
const isOccMedEmployerQuery = (
  answerSource: Extract<AnswerOptionSource, { zambdaId: 'get-answer-options' }>
): boolean => {
  return answerSource.resourceType === 'Organization' && answerSource.query.includes(OCC_MED_EMPLOYER_QUERY_TOKEN);
};

const listNioEmployerAnswerOptions = async (oystehr: Oystehr): Promise<QuestionnaireItemAnswerOption[]> => {
  const organizations = await listNonInsuranceOrganizations(oystehr, { employerOnly: true });
  return organizations
    .map((option) => ({ valueReference: { reference: option.reference, display: option.name } }))
    .sort((r1, r2) => (r1.valueReference.display ?? '').localeCompare(r2.valueReference.display ?? ''));
};

const formatQueryResult = (
  result: any,
  resourceType: FhirResource['resourceType'],
  prependedIdentifier?: string
): QuestionnaireItemAnswerOption => {
  let name = resourceType === 'Organization' ? result.alias?.[0] || result.name : result.name;
  if (prependedIdentifier) {
    const identifierValue = result.identifier?.find((id: any) => {
      return (
        id.system === prependedIdentifier ||
        id.type?.coding?.some((coding: any) => coding.system === prependedIdentifier)
      );
    })?.value;
    if (identifierValue) {
      name = `${identifierValue} - ${name}`;
    }
  }
  if (name && result.id && typeof name === 'string' && typeof result.id === 'string') {
    return {
      valueReference: {
        reference: `${resourceType}/${result.id}`,
        display: name,
        type: resourceType === 'Organization' && result.name === 'Other' ? 'other' : undefined,
      },
    };
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
    if (answerSource.prependedIdentifier && typeof answerSource.prependedIdentifier !== 'string') {
      throw MALFORMED_GET_ANSWER_OPTIONS_INPUT(
        '"answerSource.prependedIdentifier" property must be a string if provided'
      );
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
