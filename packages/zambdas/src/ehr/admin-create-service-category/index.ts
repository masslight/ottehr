import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { BOOKING_CONFIG, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, ServiceCategory, toFhirResource, toRecord } from '../admin-service-categories/helpers';

interface AdminCreateServiceCategoryInput {
  serviceCategory: ServiceCategory;
}

const validateRequestParameters = (input: ZambdaInput): AdminCreateServiceCategoryInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  let parsed: any;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Request body must be valid JSON');
  }
  const { serviceCategory } = parsed;

  // Full-payload validation: toFhirResource() reconstructs the whole resource
  // from `serviceCategory`, so any missing field is a silent corruption (e.g.
  // `name: undefined`, empty type[] coding). The admin UI always sends a
  // complete record from the new-service form, so requiring all fields is
  // contract-safe.
  if (!serviceCategory || typeof serviceCategory !== 'object')
    throw INVALID_INPUT_ERROR('"serviceCategory" must be an object');

  const missing: string[] = [];
  if (!serviceCategory.code) missing.push('serviceCategory.code');
  if (!serviceCategory.name) missing.push('serviceCategory.name');
  if (serviceCategory.active === undefined) missing.push('serviceCategory.active');
  if (!serviceCategory.config) missing.push('serviceCategory.config');
  if (missing.length > 0) throw MISSING_REQUIRED_PARAMETERS(missing);

  if (typeof serviceCategory.code !== 'string') throw INVALID_INPUT_ERROR('"serviceCategory.code" must be a string');
  if (typeof serviceCategory.name !== 'string') throw INVALID_INPUT_ERROR('"serviceCategory.name" must be a string');
  if (typeof serviceCategory.active !== 'boolean')
    throw INVALID_INPUT_ERROR('"serviceCategory.active" must be a boolean');
  if (typeof serviceCategory.config !== 'object')
    throw INVALID_INPUT_ERROR('"serviceCategory.config" must be an object');

  const { config } = serviceCategory;
  if (
    typeof config.durationMinutes !== 'number' ||
    !Number.isFinite(config.durationMinutes) ||
    config.durationMinutes <= 0
  )
    throw INVALID_INPUT_ERROR('"serviceCategory.config.durationMinutes" must be a positive number');
  if (!Array.isArray(config.serviceModes) || config.serviceModes.length === 0)
    throw INVALID_INPUT_ERROR('"serviceCategory.config.serviceModes" must be a non-empty array');
  if (!Array.isArray(config.visitTypes) || config.visitTypes.length === 0)
    throw INVALID_INPUT_ERROR('"serviceCategory.config.visitTypes" must be a non-empty array');
  if (config.cadenceMinutes !== undefined && (typeof config.cadenceMinutes !== 'number' || config.cadenceMinutes <= 0))
    throw INVALID_INPUT_ERROR('"serviceCategory.config.cadenceMinutes" must be a positive number if provided');

  return { serviceCategory };
};

export const index = wrapHandler(
  'admin-create-service-category',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { serviceCategory } = validateRequestParameters(input);
    const oystehr = await getClient(input);

    // Reject codes that collide with the compiled-in catalog. BOOKING_CONFIG
    // wins on collisions, so a FHIR row with a colliding code would be
    // silently ignored at runtime — better to refuse the save with a clear
    // message than to let it land inert.
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
