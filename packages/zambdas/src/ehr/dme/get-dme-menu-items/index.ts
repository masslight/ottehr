import { APIGatewayProxyResult } from 'aws-lambda';
import { GetDmeMenuItemsInputSchema, GetDmeMenuItemsResponse } from 'utils/lib/types/api/dme.types';
import { checkOrCreateM2MClientToken, getUserToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { searchDmeMenuItems } from './helpers';

const ZAMBDA_NAME = 'get-dme-menu-items';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = validateWithSchema(GetDmeMenuItemsInputSchema, input);
  // Read by every provider placing an order, so any signed-in user may call it; only edits are role-gated.
  getUserToken(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response: GetDmeMenuItemsResponse = { items: await searchDmeMenuItems(oystehr) };
  return { statusCode: 200, body: JSON.stringify(response) };
});
