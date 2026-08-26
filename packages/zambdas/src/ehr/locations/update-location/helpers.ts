import { Location } from 'fhir/r4b';
import { SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { UpdateLocationParams } from 'utils/lib/types/api/locations';

/** Current value of a Location's stripe account extension. */
export const stripeExtValue = (location: Location): string | undefined =>
  location.extension?.find((ext) => ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString;

/**
 * Whether the request tries to set either payment-tier field, which is what gates the
 * Customer-Support-only check.
 *
 * Keyed on `!== undefined`, not truthiness: `null` and `''` are a deliberate "clear this field" and
 * must still take the authorized path, or clearing a stripe account would need no role at all.
 */
export const touchesPaymentFields = (
  params: Pick<UpdateLocationParams, 'stripeAccountId' | 'advapacsLocationId'>
): boolean => params.stripeAccountId !== undefined || params.advapacsLocationId !== undefined;
