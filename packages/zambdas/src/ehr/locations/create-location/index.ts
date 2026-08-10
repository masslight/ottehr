import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { CreateLocationParams } from 'utils/lib/types/api/locations';
import { APIErrorCode, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
import { applyLocationFields, callerCanEditPaymentFields, locationFieldsSchema, scaffoldLocation } from '../shared';

const ZAMBDA_NAME = 'create-location';
let m2mToken: string;

const CreateLocationSchema = z.object({
  name: z.string().trim().min(1, '"name" is required'),
  ...locationFieldsSchema,
});

/**
 * Creates a Location by itself — no Schedule. It scaffolds a booking-eligible
 * default (active, slugged, in-person, timezone, marked manually-created), then
 * applies any provided fields. Availability requires a Schedule attached later,
 * so a pure anchor Location can exist with none.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const params = safeValidate(CreateLocationSchema, safeJsonParse(input.body)) as unknown as CreateLocationParams;
  const { secrets } = input;

  if (params.stripeAccountId !== undefined || params.advapacsLocationId !== undefined) {
    if (!(await callerCanEditPaymentFields(input.headers?.Authorization, secrets))) {
      throw {
        code: APIErrorCode.NOT_AUTHORIZED,
        message: 'Only Customer Support may set stripeAccountId or advapacsLocationId.',
      };
    }
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const location = applyLocationFields(scaffoldLocation(params.name), params);
  const created = await oystehr.fhir.create<Location>(location);

  return { statusCode: 200, body: JSON.stringify(created) };
});
