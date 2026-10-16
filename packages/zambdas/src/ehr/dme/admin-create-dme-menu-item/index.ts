import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition } from 'fhir/r4b';
import { DmeMenuItemInputSchema, SaveDmeMenuItemResponse } from 'utils/lib/types/api/dme.types';
import { ADMIN_TIER_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { makeDmeMenuItemActivityDefinition, parseDmeMenuItem } from '../../../shared/dme';
import { assertDefined, createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { assertDmeMenuItemNameAvailable, uniqueByCode } from '../get-dme-menu-items/helpers';

const ZAMBDA_NAME = 'admin-create-dme-menu-item';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { name, hcpcsCodes, secrets } = validateWithSchema(DmeMenuItemInputSchema, input);
  await requireUserWithRole(getUserToken(input), secrets, ADMIN_TIER_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  await assertDmeMenuItemNameAvailable(oystehr, name);

  const created = await oystehr.fhir.create<ActivityDefinition>(
    makeDmeMenuItemActivityDefinition({ name, hcpcsCodes: uniqueByCode(hcpcsCodes) })
  );
  const response: SaveDmeMenuItemResponse = { item: assertDefined(parseDmeMenuItem(created), 'created DME item') };
  return { statusCode: 200, body: JSON.stringify(response) };
});
