import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const ZAMBDA_NAME = 'get-location';
let m2mToken: string;

const GetLocationSchema = z.object({
  locationId: z.string().min(1, '"locationId" is required'),
});

/** Returns a Location resource by id — the read half of pure Location CRUD. */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const { locationId } = safeValidate(GetLocationSchema, safeJsonParse(input.body));
  const { secrets } = input;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId });

  return { statusCode: 200, body: JSON.stringify(location) };
});
