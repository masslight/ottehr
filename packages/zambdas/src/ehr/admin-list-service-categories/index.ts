import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { SERVICE_CATEGORY_TAG } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { getClient, ServiceCategory, toRecord } from '../admin-service-categories/helpers';

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
    // toRecord throws on tagged-but-malformed HealthcareServices (missing
    // code or name). Log per-record and skip — a single legacy/corrupt
    // record shouldn't take down the admin list endpoint, which is the only
    // surface where admins can see and repair the rest of the catalog.
    const serviceCategories: ServiceCategory[] = [];
    for (const r of results) {
      try {
        serviceCategories.push(toRecord(r));
      } catch (e) {
        console.error(`Skipping malformed service-category HealthcareService ${r.id}:`, e);
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ serviceCategories }),
    };
  }
);
