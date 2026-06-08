import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { SERVICE_CATEGORY_TAG } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, toRecord } from '../admin-service-categories/helpers';

// No request parameters to validate — kept as a no-op for convention with the
// other admin-service-category zambdas so the call shape matches across the
// family. Body, if any, is ignored.
const validateRequestParameters = (_input: ZambdaInput): void => {};

export const index = wrapHandler(
  'admin-list-service-categories',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    validateRequestParameters(input);
    const oystehr = await getClient(input);
    const results = (
      await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [{ name: '_tag', value: SERVICE_CATEGORY_TAG.code }],
      })
    ).unbundle();
    const serviceCategories = results.map(toRecord);
    return {
      statusCode: 200,
      body: JSON.stringify({ serviceCategories }),
    };
  }
);
