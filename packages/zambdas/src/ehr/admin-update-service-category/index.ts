import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { BOOKING_CONFIG, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, ServiceCategory, toFhirResource, toRecord } from '../admin-service-categories/helpers';

interface AdminUpdateServiceCategoryInput {
  serviceCategory: ServiceCategory;
}

const validateRequestParameters = (input: ZambdaInput): AdminUpdateServiceCategoryInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { serviceCategory } = JSON.parse(input.body);

  if (!serviceCategory || typeof serviceCategory !== 'object')
    throw INVALID_INPUT_ERROR('"serviceCategory" must be an object');
  if (!serviceCategory.id) throw MISSING_REQUIRED_PARAMETERS(['serviceCategory.id']);
  if (typeof serviceCategory.id !== 'string') throw INVALID_INPUT_ERROR('"serviceCategory.id" must be a string');
  if (serviceCategory.code !== undefined && typeof serviceCategory.code !== 'string')
    throw INVALID_INPUT_ERROR('"serviceCategory.code" must be a string if provided');
  if (serviceCategory.name !== undefined && typeof serviceCategory.name !== 'string')
    throw INVALID_INPUT_ERROR('"serviceCategory.name" must be a string if provided');

  return { serviceCategory };
};

export const index = wrapHandler(
  'admin-update-service-category',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { serviceCategory } = validateRequestParameters(input);
    const oystehr = await getClient(input);

    // Reject if the post-update code collides with the compiled catalog. See
    // admin-create-service-category for the rationale (BOOKING_CONFIG wins).
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
