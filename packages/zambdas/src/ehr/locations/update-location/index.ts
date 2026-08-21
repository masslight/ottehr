import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { UpdateLocationParams } from 'utils/lib/types/api/locations';
import { RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
import { applyLocationFields, callerCanEditPaymentFields, locationFieldsSchema } from '../shared';
import { stripeExtValue, touchesPaymentFields } from './helpers';

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

  // Which keys actually arrived. A key that's absent is left untouched by `applyLocationFields`, so
  // this separates "the edit never reached us" from "the write was attempted and rejected".
  console.log(`Updating Location ${params.locationId}; fields present: [${Object.keys(params).join(', ')}]`);

  const editsPaymentFields = touchesPaymentFields(params);
  if (editsPaymentFields) {
    // Configuration identifiers (acct_…, a UUID), not credentials, so the values are logged as-is.
    // JSON.stringify keeps null (clear) distinct from undefined (absent) and from the empty string.
    console.log(
      `Payment-tier fields submitted: stripeAccountId=${JSON.stringify(params.stripeAccountId)}, ` +
        `advapacsLocationId=${JSON.stringify(params.advapacsLocationId)}`
    );
    if (!input.headers?.Authorization) {
      // Distinct from a role denial: the header never reached the zambda, so no role check was even
      // possible. `callerHasRole` returns a bare false for this, which is otherwise indistinguishable.
      console.error('Payment-tier update refused: no Authorization header on the request.');
    }
    if (!(await callerCanEditPaymentFields(input.headers?.Authorization, secrets))) {
      console.error(
        `Payment-tier update refused for Location ${params.locationId}: caller lacks the ${RoleType.CustomerSupport} role.`
      );
      throw {
        code: APIErrorCode.NOT_AUTHORIZED,
        message: 'Only Customer Support may set stripeAccountId or advapacsLocationId.',
      };
    }
    console.log('Caller authorized to edit payment-tier fields.');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  let location: Location;
  try {
    location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: params.locationId });
  } catch (error) {
    console.error(`Failed to read Location ${params.locationId}:`, error);
    throw error;
  }

  const candidate = applyLocationFields(location, params);

  if (editsPaymentFields) {
    // `candidate` is the resource about to be written, so the second value is what will be
    // persisted — if it doesn't match what was submitted, the fault is in `applyLocationFields`
    // rather than in the caller.
    console.log(
      `Stripe account on Location ${params.locationId}: ${JSON.stringify(stripeExtValue(location))} -> ` +
        `${JSON.stringify(stripeExtValue(candidate))}`
    );
  }

  let updated: Location;
  try {
    updated = await oystehr.fhir.update<Location>(candidate);
  } catch (error) {
    console.error(`Failed to write Location ${params.locationId}:`, error);
    throw error;
  }

  if (editsPaymentFields) {
    // Read back from the write response rather than trusting the request: this is the only line
    // that proves the value actually landed.
    console.log(`Location ${params.locationId} saved; stripe account now ${JSON.stringify(stripeExtValue(updated))}`);
  }

  return { statusCode: 200, body: JSON.stringify(updated) };
});
