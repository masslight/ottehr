import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, SERVICE_CATEGORY_TAG, toRecord } from '../admin-service-categories/helpers';

export const index = wrapHandler(
  'admin-list-service-categories',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
