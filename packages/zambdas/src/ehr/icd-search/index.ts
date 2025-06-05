import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, IcdSearchResponse, MISSING_NLM_API_KEY_ERROR, SecretsKeys } from 'utils';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, search, sabs } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const apiKey = getSecret(SecretsKeys.NLM_API_KEY, secrets);

    if (!apiKey) {
      throw MISSING_NLM_API_KEY_ERROR;
    }

    const responseCodes = (
      await Promise.all([searchCodesByName(apiKey, search, sabs), searchCodesByCode(apiKey, search, sabs)])
    )
      .flatMap((result) => result.codes)
      .filter((codeValues, index, self) => index === self.findIndex((t) => t.code === codeValues.code));

    const response: IcdSearchResponse = {
      codes: responseCodes,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return await topLevelCatch('ehr-icd-search', error, input.secrets);
  }
};

const searchCodesByName = async (
  apiKey: string,
  search: string,
  sabs: 'ICD10CM' | 'CPT'
): Promise<IcdSearchResponse> => {
  const results: IcdSearchResponse = { codes: [] };
  const encodedSearchString = encodeURIComponent(search);
  const queryParams = `apiKey=${apiKey}&pageSize=50&returnIdType=code&inputType=sourceUi&string=${encodedSearchString}&sabs=${sabs}&searchType=normalizedWords&partialSearch=true`;
  const urlToFetch = `https://uts-ws.nlm.nih.gov/rest/search/current?${queryParams}`;
  try {
    const icdResponse = await fetch(urlToFetch);
    if (!icdResponse.ok) {
      throw new Error(icdResponse.statusText);
    }
    const icdResponseBody = (await icdResponse.json()) as {
      pageSize: number;
      pageNumber: number;
      result: {
        results: {
          ui: string;
          name: string;
        }[];
      };
    };
    results.codes = icdResponseBody.result.results.map((entry) => ({
      code: entry.ui,
      display: entry.name,
    }));
  } catch (error) {
    console.error('Error while trying to request NLM ICD10 search endpoint', error, JSON.stringify(error));
    throw new Error('Error while trying to get ICD-10 codes');
  }

  return results;
};

const searchCodesByCode = async (
  apiKey: string,
  search: string,
  sabs: 'ICD10CM' | 'CPT'
): Promise<IcdSearchResponse> => {
  const results: IcdSearchResponse = { codes: [] };
  const encodedSearchString = encodeURIComponent(search);
  const queryParams = `apiKey=${apiKey}&pageSize=50&returnIdType=code&inputType=sourceUi&string=${encodedSearchString}&sabs=${sabs}&searchType=rightTruncation&partialSearch=true`;
  const urlToFetch = `https://uts-ws.nlm.nih.gov/rest/search/current?${queryParams}`;
  try {
    const icdResponse = await fetch(urlToFetch);
    if (!icdResponse.ok) {
      throw new Error(icdResponse.statusText);
    }
    const icdResponseBody = (await icdResponse.json()) as {
      pageSize: number;
      pageNumber: number;
      result: {
        results: {
          ui: string;
          name: string;
        }[];
      };
    };
    results.codes = icdResponseBody.result.results.map((entry) => ({
      code: entry.ui,
      display: entry.name,
    }));
  } catch (error) {
    console.error('Error while trying to request NLM ICD10 search endpoint', error, JSON.stringify(error));
    throw new Error('Error while trying to get ICD-10 codes');
  }

  return results;
};
