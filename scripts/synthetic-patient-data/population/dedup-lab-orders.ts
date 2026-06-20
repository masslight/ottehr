// Removes duplicate in-house lab orders on an encounter — keeps ONE order per
// (encounter, test name) and deletes the extras plus their dependent
// DiagnosticReport / Observation / Specimen / Task resources. Fixes the flu
// double-order left by an idempotency-miss in an earlier backfill run.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx dedup-lab-orders.ts [--dry]

import Oystehr from '@oystehr/sdk';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const DRY = process.argv.includes('--dry');

const isLabSR = (s: any): boolean =>
  !!(s.code?.text || s.code?.coding?.[0]?.display) &&
  !(s.meta?.tag || []).some((t: any) =>
    ['disposition-follow-up', 'sub-follow-up', 'procedure', 'radiology'].includes(t.code)
  );
const srName = (s: any): string => (s.code?.text || s.code?.coding?.[0]?.display || '').toLowerCase();

(async () => {
  const tk = await (
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
    accessToken: (tk as any).access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  // Find all lab ServiceRequests, group by encounter+name.
  const byKey = new Map<string, any[]>();
  let offset = 0;
  for (;;) {
    const b = await o.fhir.search({
      resourceType: 'ServiceRequest',
      params: [
        { name: '_count', value: '1000' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const srs = b.unbundle().filter((r: any) => r.resourceType === 'ServiceRequest') as any[];
    if (!srs.length) break;
    for (const s of srs) {
      if (!isLabSR(s)) continue;
      const enc = s.encounter?.reference?.split('/')[1];
      if (!enc) continue;
      const key = `${enc}|${srName(s)}`;
      (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(s);
    }
    offset += srs.length;
    if (srs.length < 1000) break;
  }

  const dups = [...byKey.entries()].filter(([, arr]) => arr.length > 1);
  const totalExtra = dups.reduce((s, [, arr]) => s + (arr.length - 1), 0);
  console.log(
    `(encounter,test) groups with duplicates: ${dups.length} | extra orders to remove: ${totalExtra}${
      DRY ? '  [DRY]' : ''
    }`
  );
  if (DRY) {
    for (const [key, arr] of dups.slice(0, 15)) console.log(`  ${key} ×${arr.length}`);
    return;
  }

  const delDeps = async (srId: string): Promise<void> => {
    // DiagnosticReport, Observation, Task by based-on; Specimen by SR.specimen ref.
    for (const rt of ['DiagnosticReport', 'Observation', 'Task'] as const) {
      const rs = (
        await o.fhir.search({
          resourceType: rt,
          params: [
            { name: 'based-on', value: `ServiceRequest/${srId}` },
            { name: '_count', value: '100' },
          ],
        })
      ).unbundle() as any[];
      for (const r of rs) if (r.id) await o.fhir.delete({ resourceType: rt, id: r.id }).catch(() => {});
    }
  };

  let removed = 0;
  let n = 0;
  for (const [, arr] of dups) {
    // Keep the earliest-created; delete the rest.
    const sorted = arr.sort((a, b) => (a.meta?.lastUpdated || '').localeCompare(b.meta?.lastUpdated || ''));
    for (const s of sorted.slice(1)) {
      try {
        await delDeps(s.id);
        // Specimens referenced by this SR
        for (const spRef of s.specimen || []) {
          const id = spRef.reference?.split('/')[1];
          if (id) await o.fhir.delete({ resourceType: 'Specimen', id }).catch(() => {});
        }
        await o.fhir.delete({ resourceType: 'ServiceRequest', id: s.id }).catch(() => {});
        removed++;
      } catch (e: any) {
        console.log(`  ✗ ${s.id}: ${e?.message ?? e}`);
      }
    }
    n++;
    if (n % 25 === 0) console.log(`  …${n}/${dups.length} groups (removed ${removed})`);
  }
  console.log(`\nDone. Removed ${removed} duplicate lab orders (+ dependents).`);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
