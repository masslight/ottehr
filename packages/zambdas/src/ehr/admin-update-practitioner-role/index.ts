import { APIGatewayProxyResult } from 'aws-lambda';
import { PractitionerRole } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';

interface AdminUpdatePractitionerRoleInput {
  roleId: string;
  /** New full set of HealthcareService ids the role offers; replaces existing. */
  categoryHealthcareServiceIds?: string[];
  /** New Location id for this role. Replaces the existing location reference. */
  locationId?: string;
}

const ZAMBDA_NAME = 'admin-update-practitioner-role';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw new Error('No request body provided');
  if (!input.secrets) throw new Error('No secrets provided');
  const parsed = JSON.parse(input.body) as Partial<AdminUpdatePractitionerRoleInput>;

  if (!parsed.roleId || typeof parsed.roleId !== 'string') {
    throw new Error('roleId is required');
  }
  const hasCategories = Array.isArray(parsed.categoryHealthcareServiceIds);
  const hasLocation = typeof parsed.locationId === 'string' && parsed.locationId.length > 0;
  if (!hasCategories && !hasLocation) {
    throw new Error('At least one of categoryHealthcareServiceIds or locationId must be provided');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  const operations: Array<{ op: 'add'; path: string; value: any }> = [];
  if (hasCategories) {
    operations.push({
      op: 'add',
      path: '/healthcareService',
      value: (parsed.categoryHealthcareServiceIds ?? []).map((id) => ({
        reference: `HealthcareService/${id}`,
      })),
    });
  }
  if (hasLocation) {
    operations.push({
      op: 'add',
      path: '/location',
      value: [{ reference: `Location/${parsed.locationId}` }],
    });
  }

  const updated = await oystehr.fhir.patch<PractitionerRole>({
    resourceType: 'PractitionerRole',
    id: parsed.roleId,
    operations,
  });

  return { statusCode: 200, body: JSON.stringify({ role: updated }) };
});
