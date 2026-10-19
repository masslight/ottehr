// From packages/zambdas, with the account's own key:
//   KEY=rk_live_... npx tsx src/scripts/create-stripe-webhook.ts billing \
//     https://project-api.zapehr.com/v1/zambda/<billing-stripe-webhook id>/execute-public "Clinic A"
//   KEY=rk_live_... npx tsx src/scripts/create-stripe-webhook.ts clinical \
//     https://project-api.zapehr.com/v1/zambda/<clinical-stripe-webhook id>/execute-public "Clinic A"
// The endpoint ends up disabled; enable it with update-stripe-webhook.ts once the printed entry is deployed.
import Stripe from 'stripe';

const TARGETS = {
  billing: {
    envKey: 'STRIPE_WEBHOOK_SECRET',
    events: ['charge.succeeded', 'charge.updated', 'refund.created', 'refund.updated', 'refund.failed', 'invoice.paid'],
  },
  clinical: {
    envKey: 'STRIPE_CLINICAL_WEBHOOK_SECRET',
    events: [
      'refund.created',
      'refund.updated',
      'refund.failed',
      'invoice.paid',
      'invoice.voided',
      'invoice.marked_uncollectible',
    ],
  },
} as const;

async function main(): Promise<void> {
  const [target, url, name] = process.argv.slice(2);
  const config = TARGETS[target as keyof typeof TARGETS];
  const apiKey = process.env.KEY;
  if (!config || !url || !name || !apiKey) {
    throw new Error('Usage: KEY=<key> create-stripe-webhook.ts <billing|clinical> <url> <name>');
  }

  const stripe = new Stripe(apiKey);
  // rk_ keys usually can't read their own account, but Stripe's permission error names it
  const accountId = await stripe.accounts.retrieve().then(
    (account) => account.id,
    (error: Error) =>
      (error instanceof Stripe.errors.StripePermissionError &&
        error.message.match(/on account ['"](acct_\w+)['"]/)?.[1]) ||
      Promise.reject(error)
  );
  const destinations = stripe.v2.core.eventDestinations;
  const { id, webhook_endpoint } = await destinations.create({
    name,
    description: `Ottehr ${target}`,
    type: 'webhook_endpoint',
    webhook_endpoint: { url },
    events_from: ['self'],
    event_payload: 'snapshot',
    snapshot_api_version: '2024-04-10', // must match getStripeClient's apiVersion
    enabled_events: [...config.events],
    include: ['webhook_endpoint.signing_secret'],
  });
  console.log(`Created ${id}. ${config.envKey} entry:`);
  console.log(JSON.stringify({ name, accountId, signingSecret: webhook_endpoint?.signing_secret }, null, 2));

  await destinations.disable(id);
  console.log(`Disabled ${id}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
