import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-service-categories/helpers';

interface AdminDeleteServiceCategoryInput {
  serviceCategoryId: string;
}

const validateRequestParameters = (input: ZambdaInput): AdminDeleteServiceCategoryInput => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { serviceCategoryId } = JSON.parse(input.body);
  if (!serviceCategoryId) throw MISSING_REQUIRED_PARAMETERS(['serviceCategoryId']);
  if (typeof serviceCategoryId !== 'string') throw INVALID_INPUT_ERROR('"serviceCategoryId" must be a string');
  return { serviceCategoryId };
};

export const index = wrapHandler(
  'admin-delete-service-category',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { serviceCategoryId } = validateRequestParameters(input);
    const oystehr = await getClient(input);

    // Soft delete — flip active=false so slot generators still resolve historical bookings.
    const existing = await oystehr.fhir.get<HealthcareService>({
      resourceType: 'HealthcareService',
      id: serviceCategoryId,
    });
    await oystehr.fhir.update<HealthcareService>({ ...existing, active: false });
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Service category deactivated' }),
    };
  }
);
