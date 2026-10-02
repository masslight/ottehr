// From packages/zambdas, with the key of the account that owns the destination:
//   KEY=rk_live_... npx tsx src/scripts/update-stripe-webhook.ts
//   KEY=rk_live_... npx tsx src/scripts/update-stripe-webhook.ts ed_123 enable \
//     https://project-api.zapehr.com/v1/zambda/<zambda id>/execute-public
//   KEY=rk_live_... npx tsx src/scripts/update-stripe-webhook.ts ed_123 disable
// With no arguments it lists the account's destinations. The URL is optional; when given, the destination is repointed.
import Stripe from 'stripe';

const describe = (destination: Stripe.V2.EventDestination): string =>
  `${destination.id} is ${destination.status} at ${destination.webhook_endpoint?.url} (${destination.name})`;

async function main(): Promise<void> {
  const [id, action, url] = process.argv.slice(2);
  const apiKey = process.env.KEY;
  if (!apiKey || (id && action !== 'enable' && action !== 'disable')) {
    throw new Error('Usage: KEY=<key> update-stripe-webhook.ts [<ed_id> <enable|disable> [url]]');
  }

  const destinations = new Stripe(apiKey).v2.core.eventDestinations;
  if (!id) {
    for await (const destination of destinations.list({ include: ['webhook_endpoint.url'] })) {
      console.log(describe(destination));
    }
    return;
  }

  if (url) await destinations.update(id, { webhook_endpoint: { url } });
  await (action === 'enable' ? destinations.enable(id) : destinations.disable(id));
  console.log(describe(await destinations.retrieve(id, { include: ['webhook_endpoint.url'] })));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
