import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, ServiceCategoryRecord, toFhirResource, toRecord } from '../admin-service-categories/helpers';

export const index = wrapHandler(
  'admin-create-service-category',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    const oystehr = await getClient(input);
    const { serviceCategory } = JSON.parse(input.body) as { serviceCategory: ServiceCategoryRecord };
    if (!serviceCategory?.code || !serviceCategory?.name)
      throw new Error('serviceCategory.code and serviceCategory.name are required');

    const resource = toFhirResource({ ...serviceCategory, id: undefined });
    const created = await oystehr.fhir.create<HealthcareService>(resource);
    return {
      statusCode: 200,
      body: JSON.stringify({ serviceCategory: toRecord(created) }),
    };
  }
);
