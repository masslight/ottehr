import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { APIErrorCode, MISSING_REQUEST_BODY, UpdateLocationParams } from 'utils';
import { z } from 'zod';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  safeJsonParse,
  safeValidate,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { applyLocationFields, callerCanEditPaymentFields, locationFieldsSchema } from '../shared';

const ZAMBDA_NAME = 'update-location';
let m2mToken: string;

const UpdateLocationSchema = z.object({
  locationId: z.string().min(1, '"locationId" is required'),
  name: z.string().optional(),
  ...locationFieldsSchema,
});

/**
 * Updates a Location's intrinsic fields, keyed by the LOCATION id — no Schedule
 * required. This is the decoupling: editing a Location is independent of whether it
 * owns a schedule (so anchor-only Locations are editable). Only fields present in
 * the body are changed.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const params = safeValidate(UpdateLocationSchema, safeJsonParse(input.body)) as unknown as UpdateLocationParams;
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

  const location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: params.locationId });
  const updated = await oystehr.fhir.update<Location>(applyLocationFields(location, params));

  return { statusCode: 200, body: JSON.stringify(updated) };
});
