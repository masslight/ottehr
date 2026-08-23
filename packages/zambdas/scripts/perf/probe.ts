/**
 * get-employees derives `seenPatientRecently` from two PROJECT-WIDE Encounter searches, then keeps
 * only the participants that are employees. Scoping those searches to the employees' own
 * Practitioner refs should give the same answer far more cheaply — this checks that, and also checks
 * whether the unbounded version is being silently truncated by the default page size (which would
 * make it not just slow but wrong).
 *   ENV=local VITEST=true npx tsx scripts/perf/probe.ts
 */
import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { fmt, startBenchServer } from './lib';

const participantRefs = (encounters: Encounter[]): Set<string> => {
  const refs = new Set<string>();
  encounters.forEach((encounter) =>
    (encounter.participant ?? []).forEach((participant) => {
      const ref = participant.individual?.reference;
      if (ref?.startsWith('Practitioner/')) refs.add(ref);
    })
  );
  return refs;
};

const main = async (): Promise<void> => {
  const server = await startBenchServer();
  const oystehr = server.oystehrAdmin;
  try {
    const practitionerRefs = (await oystehr.user.list())
      .filter((user) => !user.name.startsWith('+') && user.profile?.startsWith('Practitioner/'))
      .map((user) => user.profile);
    console.log(`${practitionerRefs.length} employee Practitioner profiles\n`);

    const cut = DateTime.now().minus({ minutes: 30 }).toFormat("yyyy-MM-dd'T'HH:mm");

    const run = async (label: string, params: { name: string; value: string }[]): Promise<Set<string>> => {
      const t = performance.now();
      const bundle = await oystehr.fhir.search<Encounter>({ resourceType: 'Encounter', params });
      const encounters = bundle.unbundle();
      const refs = participantRefs(encounters);
      const ours = new Set([...refs].filter((ref) => practitionerRefs.includes(ref)));
      console.log(
        `${label}\n    ${fmt(performance.now() - t)}  encounters=${encounters.length} total=${
          (bundle as any).total
        } practitionerRefs=${refs.size} ofWhichEmployees=${ours.size}`
      );
      return ours;
    };

    // exactly what the handler sends today
    const wideInProgress = await run('WIDE  in-progress (as shipped, no _count)', [
      { name: 'status', value: 'in-progress' },
      { name: '_elements', value: 'id,participant' },
    ]);
    const wideFinished = await run('WIDE  finished>cut (as shipped, no _count)', [
      { name: 'status', value: 'finished' },
      { name: 'date', value: `gt${cut}` },
      { name: '_elements', value: 'id,participant' },
    ]);

    // scoped to the employees we actually test
    const scopedInProgress = await run('SCOPED in-progress (participant=employees)', [
      { name: 'status', value: 'in-progress' },
      { name: 'participant', value: practitionerRefs.join(',') },
      { name: '_elements', value: 'id,participant' },
      { name: '_count', value: '1000' },
    ]);
    const scopedFinished = await run('SCOPED finished>cut (participant=employees)', [
      { name: 'status', value: 'finished' },
      { name: 'date', value: `gt${cut}` },
      { name: 'participant', value: practitionerRefs.join(',') },
      { name: '_elements', value: 'id,participant' },
      { name: '_count', value: '1000' },
    ]);

    const wide = new Set([...wideInProgress, ...wideFinished]);
    const scoped = new Set([...scopedInProgress, ...scopedFinished]);
    console.log('');
    console.log(`employees flagged seenPatientRecently — wide: ${wide.size}, scoped: ${scoped.size}`);
    const onlyWide = [...wide].filter((r) => !scoped.has(r));
    const onlyScoped = [...scoped].filter((r) => !wide.has(r));
    console.log(`only in wide:   ${onlyWide.length} ${onlyWide.slice(0, 3).join(',')}`);
    console.log(`only in scoped: ${onlyScoped.length} ${onlyScoped.slice(0, 3).join(',')}`);
  } finally {
    await server.close();
  }
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
