// Verifies the synthetic population landed correctly: queries Appointments over
// the trailing 12-month window (the same `date` param the ad-hoc report uses)
// and tallies status, month, location, and distinct patients. Confirms visits
// are backdated (spread across months, not all "today") and completed
// (status=fulfilled), and that the LA/NY split is even.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json \
//     npx tsx scripts/synthetic-patient-data/population/verify-population.ts [--days 400]

import { argInt } from '../shared/cli';
import { createOystehrFromEnv, searchAllPages } from '../shared/oystehr-client';

(async () => {
  const days = argInt('--days', { default: 400, min: 1 });
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const o = await createOystehrFromEnv();

  // Resolve location names once.
  const locBundle = await o.fhir.search({ resourceType: 'Location', params: [{ name: '_count', value: '100' }] });
  const locName: Record<string, string> = {};
  for (const l of locBundle.unbundle() as any[]) if (l.id) locName[l.id] = l.name || l.id;

  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byLocation: Record<string, number> = {};
  const patients = new Set<string>();
  let total = 0;

  const appts = await searchAllPages<any>(
    o,
    'Appointment',
    [
      { name: 'date', value: `ge${startISO}` },
      { name: 'date', value: `le${endISO}` },
    ],
    { pageSize: 1000 }
  );
  for (const a of appts) {
    total++;
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    if (a.start) byMonth[a.start.slice(0, 7)] = (byMonth[a.start.slice(0, 7)] ?? 0) + 1;
    const locRef = a.participant?.find((p: any) => p.actor?.reference?.startsWith('Location/'))?.actor?.reference;
    const locId = locRef?.replace('Location/', '');
    const ln = locId ? locName[locId] ?? locId : '(none)';
    byLocation[ln] = (byLocation[ln] ?? 0) + 1;
    const patRef = a.participant?.find((p: any) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
    if (patRef) patients.add(patRef);
  }

  console.log(`Window: ${startISO.slice(0, 10)} → ${endISO.slice(0, 10)} (${days} days)`);
  console.log(`Total appointments: ${total}`);
  console.log(`Distinct patients:  ${patients.size}`);
  console.log(`\nBy status:`);
  for (const [s, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) console.log(`  ${s.padEnd(14)} ${n}`);
  console.log(`\nBy location:`);
  for (const [l, n] of Object.entries(byLocation).sort((a, b) => b[1] - a[1])) console.log(`  ${l.padEnd(16)} ${n}`);
  console.log(`\nBy month:`);
  for (const [m, n] of Object.entries(byMonth).sort()) console.log(`  ${m}  ${n}`);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
