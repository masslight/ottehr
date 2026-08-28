import { PaymentNotice } from 'fhir/r4b';
import fs from 'fs';
import Stripe from 'stripe';
import { performEffect } from '../packages/zambdas/src/billing/billing-stripe-webhook';
import { createBillingClient, createEraReadClient } from '../packages/zambdas/src/billing/shared';
import { fetchAllPages } from '../packages/zambdas/src/shared/fhir';
import { getAuth0Token } from '../packages/zambdas/src/shared/getAuth0Token';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../packages/zambdas/src/shared/stripeIntegration';

/**
 * Backfills missing billing PaymentNotices for Stripe charges the webhook never recorded
 * (missed deliveries or charges predating the webhook). For each succeeded charge in the
 * window with no matching PaymentNotice in ANY scope, replays the webhook's own
 * charge.succeeded handling — the same idempotent upsert production uses.
 *
 * Dry-run by default; pass --apply to write.
 *
 * How to use (from the repo root):
 *   npx tsx scripts/backfill-billing-payment-notices.ts \
 *     --env=urgikids-production --from=2026-08-01 --to=2026-08-28 \
 *     [--stripe-account=acct_...] [--apply]
 */

function getArg(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
}

function requireArg(name: string): string {
  const value = getArg(name);
  if (!value) throw new Error(`--${name}= is required`);
  return value;
}

async function fetchWindowNotices(
  client: { fhir: { search: (args: any) => Promise<{ unbundle: () => PaymentNotice[] }> } },
  from: string,
  to: string
): Promise<PaymentNotice[]> {
  const notices: PaymentNotice[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await client.fhir.search({
      resourceType: 'PaymentNotice',
      params: [
        { name: 'created', value: `ge${from}` },
        { name: 'created', value: `le${to}` },
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    notices.push(...bundle.unbundle());
    return bundle;
  }, 200);
  return notices;
}

async function main(): Promise<void> {
  const from = requireArg('from');
  const to = requireArg('to');
  const apply = process.argv.includes('--apply');
  const stripeAccount = getArg('stripe-account');
  const secrets = JSON.parse(fs.readFileSync(`packages/zambdas/.env/${requireArg('env')}.json`, 'utf8'));

  const stripe = getStripeClient(secrets);
  console.log('Minting M2M token…');
  const token = await getAuth0Token(secrets);
  const oystehr = createBillingClient(token, secrets);
  const untaggedClient = createEraReadClient(token, secrets);

  // known stripe ids from notices in EITHER scope — the report reads both now
  const [billingNotices, unscopedNotices] = await Promise.all([
    fetchWindowNotices(oystehr, from, to),
    fetchWindowNotices(untaggedClient, from, to),
  ]);
  const knownStripeIds = new Set(
    [...billingNotices, ...unscopedNotices]
      .filter((notice) => notice.status === 'active')
      .flatMap((notice) =>
        (notice.identifier ?? [])
          .filter((identifier) => identifier.system === STRIPE_PAYMENT_ID_SYSTEM)
          .map((identifier) => identifier.value ?? '')
          .filter(Boolean)
      )
  );
  console.log(`Known Stripe ids on existing notices: ${knownStripeIds.size}`);

  const fromSeconds = Math.floor(new Date(from).getTime() / 1000);
  const toSeconds = Math.floor(new Date(to).getTime() / 1000) + 86400;
  const listing = stripe.charges.list({ created: { gte: fromSeconds, lt: toSeconds }, limit: 100 }, { stripeAccount });

  let scanned = 0;
  let skipped = 0;
  let backfilled = 0;
  let failed = 0;
  for await (const charge of listing) {
    if (charge.status !== 'succeeded' || !charge.paid) continue;
    scanned += 1;
    const ids = [
      charge.id,
      typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id,
      typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id,
    ].filter((id): id is string => !!id);
    if (ids.some((id) => knownStripeIds.has(id))) {
      skipped += 1;
      continue;
    }

    const amount = (charge.amount / 100).toFixed(2);
    if (!apply) {
      console.log(
        `[dry-run] would backfill ${charge.id} ($${amount}, ${new Date(charge.created * 1000)
          .toISOString()
          .slice(0, 10)})`
      );
      backfilled += 1;
      continue;
    }
    try {
      const event = {
        id: `backfill_${charge.id}`,
        type: 'charge.succeeded',
        account: stripeAccount,
        data: { object: charge },
      } as unknown as Stripe.Event;
      await performEffect(oystehr, { event, secrets });
      console.log(`backfilled ${charge.id} ($${amount})`);
      backfilled += 1;
    } catch (err) {
      failed += 1;
      console.error(`FAILED ${charge.id}: ${(err as Error)?.message}`);
    }
  }

  console.log(
    `\nDone. scanned=${scanned} already-recorded=${skipped} ${
      apply ? 'backfilled' : 'would-backfill'
    }=${backfilled} failed=${failed}`
  );
  if (!apply) console.log('Dry run — re-run with --apply to write PaymentNotices.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
