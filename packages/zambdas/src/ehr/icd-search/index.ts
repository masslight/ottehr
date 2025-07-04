import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, IcdSearchResponse, MISSING_NLM_API_KEY_ERROR, SecretsKeys } from 'utils';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, search, sabs, radiologyOnly } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const apiKey = getSecret(SecretsKeys.NLM_API_KEY, secrets);

    if (!apiKey) {
      throw MISSING_NLM_API_KEY_ERROR;
    }

    const responseCodes = (
      await Promise.all([
        // fetching both NAME and CODE search results in parallel
        searchTerminology(apiKey, search, sabs, 'NAME', radiologyOnly),
        searchTerminology(apiKey, search, sabs, 'CODE', radiologyOnly),
      ])
    )
      .flatMap((result) => result.codes) // Flatten the array of arrays into a single array and map to codes.
      .filter((codeValues, index, self) => index === self.findIndex((t) => t.code === codeValues.code)) // Remove duplicates based on code
      .sort((a, b) => a.code.localeCompare(b.code)); // Sort alphabetically by code.

    const response: IcdSearchResponse = {
      codes: responseCodes,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return await topLevelCatch('ehr-icd-search', error, ENVIRONMENT);
  }
};

const searchTerminology = async (
  apiKey: string,
  search: string,
  sabs: 'ICD10CM' | 'CPT',
  codeOrName: 'CODE' | 'NAME',
  radiologyOnly: boolean | undefined = false
): Promise<IcdSearchResponse> => {
  const results: IcdSearchResponse = { codes: [] };
  const encodedSearchString = encodeURIComponent(search);
  const baseQueryParams = `apiKey=${apiKey}&pageSize=50&returnIdType=code&inputType=sourceUi&string=${encodedSearchString}&sabs=${sabs}`;
  let completeQueryParams: string;
  if (codeOrName === 'NAME') {
    completeQueryParams = `${baseQueryParams}&searchType=normalizedWords&partialSearch=true`;
  } else {
    // codeOrName === 'CODE'
    completeQueryParams = `${baseQueryParams}&searchType=rightTruncation&partialSearch=true`;
  }
  const urlToFetch = `https://uts-ws.nlm.nih.gov/rest/search/current?${completeQueryParams}`;
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

    if (sabs === 'CPT' && radiologyOnly) {
      results.codes = results.codes.filter((code) => {
        return code.code >= '7000' && code.code <= '7999'; // Filter codes to only include ICD-10 codes in the radiology range.
      });
    }
  } catch (error) {
    console.error('Error while trying to request NLM ICD10 search endpoint', error, JSON.stringify(error));
    throw new Error('Error while trying to get ICD-10 codes');
  }

  return results;
};
