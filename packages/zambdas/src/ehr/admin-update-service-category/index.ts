import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, ServiceCategoryRecord, toFhirResource, toRecord } from '../admin-service-categories/helpers';

export const index = wrapHandler(
  'admin-update-service-category',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    const oystehr = await getClient(input);
    const { serviceCategory } = JSON.parse(input.body) as { serviceCategory: ServiceCategoryRecord };
    if (!serviceCategory?.id) throw new Error('serviceCategory.id is required for update');

    const resource = toFhirResource(serviceCategory);
    const updated = await oystehr.fhir.update<HealthcareService>(resource);
    return {
      statusCode: 200,
      body: JSON.stringify({ serviceCategory: toRecord(updated) }),
    };
  }
);
