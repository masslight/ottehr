import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { SaveDmeMenuItemResponse, UpdateDmeMenuItemInputSchema } from 'utils/lib/types/api/dme.types';
import { ADMIN_TIER_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { makeDmeMenuItemActivityDefinition, parseDmeMenuItem } from '../../../shared/dme';
import { assertDefined, createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import {
  assertDmeMenuItemNameAvailable,
  getDmeMenuItemResourceOrThrow,
  uniqueByCode,
} from '../get-dme-menu-items/helpers';

const ZAMBDA_NAME = 'admin-update-dme-menu-item';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { menuItemId: id, name, hcpcsCodes, secrets } = validateWithSchema(UpdateDmeMenuItemInputSchema, input);
  await requireUserWithRole(getUserToken(input), secrets, ADMIN_TIER_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const existing = await getDmeMenuItemResourceOrThrow(oystehr, id);
  await assertDmeMenuItemNameAvailable(oystehr, name, id);

  const updated = await oystehr.fhir.update<ActivityDefinition>(
    makeDmeMenuItemActivityDefinition({ name, hcpcsCodes: uniqueByCode(hcpcsCodes) }, id),
    { optimisticLockingVersionId: existing.meta?.versionId }
  );
  const response: SaveDmeMenuItemResponse = { item: assertDefined(parseDmeMenuItem(updated), 'updated DME item') };
  return { statusCode: 200, body: JSON.stringify(response) };
});
