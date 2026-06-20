// Deletes future-dated Slots on the in-person Location schedules. The population
// build backdates every real visit's slot to the past (Phase 15), so any Slot
// whose start is still in the future is an orphan left by a failed scaffold
// booking. These pile up and eventually block new bookings (create-appointment
// 4019). Safe: legitimate visits never have a future slot.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx clear-orphan-slots.ts

import Oystehr from '@oystehr/sdk';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const SCHEDULES = ['acee5327-944f-4787-a922-280e613d2737', '944ec4c0-9098-480b-9d96-9927645fd670'];

(async () => {
  const t = await (
    await fetch(need('AUTH0_ENDPOINT'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.AUTH0_CLIENT,
        client_secret: process.env.AUTH0_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
        grant_type: 'client_credentials',
      }),
    })
  ).json();
  const o = new Oystehr({
    accessToken: (t as any).access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  const nowISO = new Date().toISOString();
  let deleted = 0;
  for (const sched of SCHEDULES) {
    let offset = 0;
    for (;;) {
      const bundle = await o.fhir.search({
        resourceType: 'Slot',
        params: [
          { name: 'schedule', value: `Schedule/${sched}` },
          { name: 'start', value: `gt${nowISO}` },
          { name: '_count', value: '500' },
          { name: '_offset', value: String(offset) },
        ],
      });
      const slots = bundle.unbundle().filter((r: any) => r.resourceType === 'Slot') as any[];
      if (!slots.length) break;
      for (const s of slots) {
        if (!s.id) continue;
        try {
          await o.fhir.delete({ resourceType: 'Slot', id: s.id });
          deleted++;
        } catch (e: any) {
          console.log(`  skip Slot/${s.id}: ${e?.message ?? e}`);
        }
      }
      offset += slots.length;
      if (slots.length < 500) break;
    }
  }
  console.log(`Deleted ${deleted} future (orphan) slots.`);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
