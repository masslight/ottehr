import { APIGatewayProxyResult } from 'aws-lambda';
import { DeleteDmeMenuItemInputSchema } from 'utils/lib/types/api/dme.types';
import { ADMIN_TIER_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { getDmeMenuItemResourceOrThrow } from '../get-dme-menu-items/helpers';

const ZAMBDA_NAME = 'admin-delete-dme-menu-item';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { menuItemId: id, secrets } = validateWithSchema(DeleteDmeMenuItemInputSchema, input);
  await requireUserWithRole(getUserToken(input), secrets, ADMIN_TIER_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Guards against deleting an unrelated ActivityDefinition; orders keep their own copy of name and codes.
  await getDmeMenuItemResourceOrThrow(oystehr, id);
  await oystehr.fhir.delete({ resourceType: 'ActivityDefinition', id });

  return { statusCode: 200, body: JSON.stringify({ message: 'DME item deleted' }) };
});
