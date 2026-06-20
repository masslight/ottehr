// Deletes all non-fulfilled (incomplete) Appointments in the project plus their
// linked Encounter / QuestionnaireResponse / harvest Tasks. The population is
// meant to be uniformly signed-complete (Appointment.status = fulfilled); any
// booked/arrived/checked-in/proposed/pending/waitlist appointment is leftover
// test/debug data. Patients/Coverage/etc. are left in place (shared, reused).
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx clean-incomplete-appointments.ts [--dry]

import Oystehr from '@oystehr/sdk';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const DRY = process.argv.includes('--dry');

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

  const b = await o.fhir.search({
    resourceType: 'Appointment',
    params: [
      {
        name: 'status',
        value: 'proposed,pending,booked,arrived,checked-in,waitlist,noshow,cancelled,entered-in-error',
      },
      { name: '_count', value: '500' },
    ],
  });
  const appts = b.unbundle().filter((r: any) => r.resourceType === 'Appointment' && r.status !== 'fulfilled') as any[];
  console.log(`Found ${appts.length} non-fulfilled appointments.${DRY ? ' [DRY]' : ''}`);

  const del = async (rt: string, id: string): Promise<void> => {
    if (DRY) return;
    try {
      await o.fhir.delete({ resourceType: rt as 'Appointment', id });
    } catch (e: any) {
      console.log(`  skip ${rt}/${id}: ${e?.message ?? e}`);
    }
  };

  let n = 0;
  for (const a of appts) {
    // Encounter(s) for this appointment
    try {
      const encs = (
        await o.fhir.search({
          resourceType: 'Encounter',
          params: [{ name: 'appointment', value: `Appointment/${a.id}` }],
        })
      ).unbundle() as any[];
      for (const e of encs) {
        // QR + tasks tied to the encounter
        try {
          const qrs = (
            await o.fhir.search({
              resourceType: 'QuestionnaireResponse',
              params: [{ name: 'encounter', value: `Encounter/${e.id}` }],
            })
          ).unbundle() as any[];
          for (const qr of qrs) {
            const tasks = (
              await o.fhir.search({
                resourceType: 'Task',
                params: [{ name: 'focus', value: `QuestionnaireResponse/${qr.id}` }],
              })
            ).unbundle() as any[];
            for (const tk of tasks) if (tk.id) await del('Task', tk.id);
            if (qr.id) await del('QuestionnaireResponse', qr.id);
          }
        } catch {
          /* ignore */
        }
        if (e.id) await del('Encounter', e.id);
      }
    } catch {
      /* ignore */
    }
    if (a.id) await del('Appointment', a.id);
    n++;
    if (n % 10 === 0) console.log(`  …${n}/${appts.length}`);
  }
  console.log(
    DRY
      ? 'Dry run — nothing deleted.'
      : `Deleted ${appts.length} incomplete appointments (+ linked encounters/QRs/tasks).`
  );
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
