import { APIGatewayProxyResult } from 'aws-lambda';
import { Location } from 'fhir/r4b';
import { SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
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
/** Current value of a Location's stripe account extension, for before/after logging. */
const stripeExtValue = (location: Location): string | undefined =>
  location.extension?.find((ext) => ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  const params = safeValidate(UpdateLocationSchema, safeJsonParse(input.body)) as unknown as UpdateLocationParams;
  const { secrets } = input;

  // Which keys the caller actually sent. A field that's absent is left untouched by
  // `applyLocationFields`, so "I saved but nothing changed" is usually a key that never arrived —
  // this line distinguishes that from a write that was attempted and rejected.
  console.log(`Updating Location ${params.locationId}; fields present: [${Object.keys(params).join(', ')}]`);

  const touchesPaymentFields = params.stripeAccountId !== undefined || params.advapacsLocationId !== undefined;
  if (touchesPaymentFields) {
    // Values are configuration identifiers (acct_…, a UUID), not credentials — safe to log, and
    // knowing exactly what was submitted is most of the diagnosis.
    console.log(
      `Payment-tier fields submitted: stripeAccountId=${JSON.stringify(
        params.stripeAccountId
      )}, advapacsLocationId=${JSON.stringify(params.advapacsLocationId)}`
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

  const before = stripeExtValue(location);
  const candidate = applyLocationFields(location, params);

  if (touchesPaymentFields) {
    // The write is a full resource replacement, so the value here is what will be persisted —
    // if this doesn't match what was submitted, the bug is in `applyLocationFields`, not the caller.
    console.log(
      `Stripe account on Location ${params.locationId}: ${JSON.stringify(before)} -> ${JSON.stringify(
        stripeExtValue(candidate)
      )}`
    );
  }

  let updated: Location;
  try {
    updated = await oystehr.fhir.update<Location>(candidate);
  } catch (error) {
    console.error(`Failed to write Location ${params.locationId}:`, error);
    throw error;
  }

  if (touchesPaymentFields) {
    // Read back from the write response rather than trusting the request: this is the only line
    // that proves the value actually landed.
    console.log(`Location ${params.locationId} saved; stripe account now ${JSON.stringify(stripeExtValue(updated))}`);
  }

  return { statusCode: 200, body: JSON.stringify(updated) };
});
