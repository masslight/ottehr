import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { BOOKING_CONFIG, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, ServiceCategoryRecord, toFhirResource, toRecord } from '../admin-service-categories/helpers';

export const index = wrapHandler(
  'admin-update-service-category',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw MISSING_REQUEST_BODY;
    const oystehr = await getClient(input);
    const { serviceCategory } = JSON.parse(input.body) as { serviceCategory: ServiceCategoryRecord };
    if (!serviceCategory?.id) throw MISSING_REQUIRED_PARAMETERS(['serviceCategory.id']);

    // Reject if the post-update code collides with the compiled catalog. See
    // admin-create-service-category for the rationale (D14 precedence).
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

    const resource = toFhirResource(serviceCategory);
    const updated = await oystehr.fhir.update<HealthcareService>(resource);
    return {
      statusCode: 200,
      body: JSON.stringify({ serviceCategory: toRecord(updated) }),
    };
  }
);
