import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService } from 'fhir/r4b';
import { FHIR_RESOURCE_NOT_FOUND, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const ZAMBDA_NAME = 'toggle-group-active';
let m2mToken: string;

const ToggleGroupActiveSchema = z.object({
  groupId: z.string().min(1, '"groupId" is required'),
  active: z.boolean(),
});

/**
 * Sets a provider group's (HealthcareService) active state. Kept separate from
 * admin-update-group so it can carry its own permission boundary and any
 * activation/deactivation side effects without entangling field-edit logic —
 * the same split used for Locations (toggle-location-active) and PractitionerRoles
 * (admin-set-practitioner-role-active). Deactivation is a soft-delete: the group
 * and all its config are kept, and booking excludes inactive HealthcareServices.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { groupId, active } = safeValidate(ToggleGroupActiveSchema, safeJsonParse(input.body));
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  try {
    await oystehr.fhir.patch<HealthcareService>({
      resourceType: 'HealthcareService',
      id: groupId,
      operations: [{ op: 'add', path: '/active', value: active }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(message)) throw FHIR_RESOURCE_NOT_FOUND('HealthcareService');
    throw err;
  }

  return { statusCode: 200, body: JSON.stringify({ id: groupId, active }) };
});
