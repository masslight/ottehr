import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import Stripe from 'stripe';
import { SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { stripeAccountIdRegex } from 'utils/lib/validation/regex';
import { fetchAllPages } from '../../../../shared/fhir';

/**
 * Platform account + connected Stripe accounts configured on clinic Locations — the accounts
 * patient invoices are created on. Candidates are verified against Stripe (test data can carry
 * junk ids). `undefined` represents the platform account.
 */
export async function listOutreachStripeAccounts(oystehr: Oystehr, stripe: Stripe): Promise<(string | undefined)[]> {
  const locations: Location[] = [];
  const fetchLocations = fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        { name: '_elements', value: 'id,extension' },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    locations.push(...bundle.unbundle());
    return bundle;
  }, 200);
  const [platformAccount] = await Promise.all([stripe.accounts.retrieve(), fetchLocations]);

  const candidates = new Set(
    locations
      .map(
        (location) =>
          location.extension?.find((ext) => ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString
      )
      .filter((value): value is string => !!value && value !== platformAccount.id && stripeAccountIdRegex.test(value))
  );

  const connectedAccounts: string[] = [];
  const unreachable: string[] = [];
  for (const account of candidates) {
    try {
      await stripe.accounts.retrieve(account);
      connectedAccounts.push(account);
    } catch (err) {
      // only confirmed-permanent failures are skipped (unknown id, revoked/deactivated account);
      // a transient failure must fail the run rather than silently skip an account's invoices
      const code = (err as Stripe.errors.StripeError)?.code;
      if (code === 'resource_missing' || code === 'account_invalid') {
        unreachable.push(account);
      } else {
        throw new Error(`Could not validate Stripe account ${account}: ${(err as Error)?.message ?? String(err)}`);
      }
    }
  }
  console.log(
    `listOutreachStripeAccounts: ${connectedAccounts.length} connected + platform (${locations.length} locations scanned)`,
    JSON.stringify({ platform: platformAccount.id, connected: connectedAccounts, unreachable })
  );
  return [undefined, ...connectedAccounts];
}
