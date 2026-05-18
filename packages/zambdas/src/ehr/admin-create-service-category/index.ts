import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { BOOKING_CONFIG, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, ServiceCategoryRecord, toFhirResource, toRecord } from '../admin-service-categories/helpers';

export const index = wrapHandler(
  'admin-create-service-category',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw MISSING_REQUEST_BODY;
    const oystehr = await getClient(input);
    const { serviceCategory } = JSON.parse(input.body) as { serviceCategory: ServiceCategoryRecord };
    if (!serviceCategory?.code || !serviceCategory?.name)
      throw MISSING_REQUIRED_PARAMETERS(['serviceCategory.code', 'serviceCategory.name']);

    // Reject codes that collide with the compiled-in catalog. Per D14
    // (BOOKING_CONFIG wins on collisions), a FHIR row with a colliding code
    // would be silently ignored at runtime — better to refuse the save with
    // a clear message than to let it land inert.
    const isCompiled = BOOKING_CONFIG.serviceCategories.some((sc) => sc.category.code === serviceCategory.code);
    if (isCompiled) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          code: 'SERVICE_CATEGORY_CODE_TAKEN',
          message: `A service with the code "${serviceCategory.code}" already exists. Choose a different code.`,
        }),
      };
    }

    const resource = toFhirResource({ ...serviceCategory, id: undefined });
    const created = await oystehr.fhir.create<HealthcareService>(resource);
    return {
      statusCode: 200,
      body: JSON.stringify({ serviceCategory: toRecord(created) }),
    };
  }
);
