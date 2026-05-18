import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient } from '../admin-service-categories/helpers';

export const index = wrapHandler(
  'admin-delete-service-category',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw MISSING_REQUEST_BODY;
    const oystehr = await getClient(input);
    const { serviceCategoryId } = JSON.parse(input.body) as { serviceCategoryId: string };
    if (!serviceCategoryId) throw MISSING_REQUIRED_PARAMETERS(['serviceCategoryId']);

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
