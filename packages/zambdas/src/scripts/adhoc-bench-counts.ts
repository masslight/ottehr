// Exact server counts for a range (READ-ONLY): _summary=count&_total=accurate, in the same 15-day windows the ideal
// way uses, at most 4 at a time. Each count is tried once and up to 3 retries on failure; a count the server refuses
// is reported as such.
//   npx tsx src/scripts/adhoc-bench-counts.ts <env> <startISO> <endISO> <out.json>
import { writeFileSync } from 'fs';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../shared/helpers';
import { performEffectWithEnvFile } from './helpers';

type Param = { name: string; value: string };
const STATUSES = 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist,cancelled,noshow';
const MODULE_TAGS = 'OTTEHR-TM,OTTEHR-IP';

const windows = (start: string, end: string): { start: string; end: string }[] => {
  const out: { start: string; end: string }[] = [];
  let cursor = Date.parse(start);
  const stop = Date.parse(end);
  while (cursor < stop) {
    const next = Math.min(cursor + 15 * 86_400_000, stop);
    out.push({ start: new Date(cursor).toISOString(), end: new Date(next).toISOString() });
    cursor = next + 1;
  }
  return out;
};

async function main(config: Record<string, string>): Promise<void> {
  const [, , , start, end, out] = process.argv;
  const token = await getAuth0Token(config as never);
  const oystehr = createClinicalOystehrClient(token, config as never);

  const count = async (resourceType: string, params: Param[]): Promise<number> => {
    for (let attempt = 1; ; attempt++) {
      try {
        const bundle = (await oystehr.fhir.search({
          resourceType: resourceType as never,
          params: [...params, { name: '_summary', value: 'count' }, { name: '_total', value: 'accurate' }],
        })) as unknown as { total?: number };
        if (typeof bundle.total !== 'number') throw new Error('no total');
        return bundle.total;
      } catch (error) {
        const code = Number((error as { code?: unknown })?.code);
        if (attempt >= 4 || code === 400 || code === 422) throw error;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  };

  const ws = windows(start, end);
  const queries: Record<string, (w: { start: string; end: string }) => [string, Param[]]> = {
    appointments: (w) => [
      'Appointment',
      [
        { name: 'date', value: `ge${w.start}` },
        { name: 'date', value: `le${w.end}` },
        { name: 'status', value: STATUSES },
        { name: '_tag', value: MODULE_TAGS },
      ],
    ],
    encountersByApptDate: (w) => [
      'Encounter',
      [
        { name: 'appointment.date', value: `ge${w.start}` },
        { name: 'appointment.date', value: `le${w.end}` },
      ],
    ],
    encountersOfModuleAppts: (w) => [
      'Encounter',
      [
        { name: 'appointment.date', value: `ge${w.start}` },
        { name: 'appointment.date', value: `le${w.end}` },
        { name: 'appointment._tag', value: MODULE_TAGS },
        { name: 'appointment.status', value: STATUSES },
      ],
    ],
    encountersWithTempTag: (w) => [
      'Encounter',
      [
        { name: 'appointment.date', value: `ge${w.start}` },
        { name: 'appointment.date', value: `le${w.end}` },
        { name: 'appointment._tag', value: MODULE_TAGS },
        { name: 'appointment.status', value: STATUSES },
        { name: '_has:Observation:encounter:_tag', value: 'vital-temperature' },
      ],
    ],
    tempObsByTag: (w) => [
      'Observation',
      [
        { name: 'encounter:Encounter.appointment.date', value: `ge${w.start}` },
        { name: 'encounter:Encounter.appointment.date', value: `le${w.end}` },
        { name: '_tag', value: 'vital-temperature' },
      ],
    ],
  };

  const result: Record<string, unknown> = { windows: ws.length };
  for (const [name, build] of Object.entries(queries)) {
    const startedAt = Date.now();
    try {
      let total = 0;
      for (let i = 0; i < ws.length; i += 4) {
        const parts = await Promise.all(ws.slice(i, i + 4).map((w) => count(...build(w))));
        total += parts.reduce((a, b) => a + b, 0);
      }
      result[name] = total;
    } catch (error) {
      result[name] = `ERROR ${(error as { code?: unknown })?.code ?? ''} ${
        error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)
      }`;
    }
    result[`${name}Ms`] = Date.now() - startedAt;
    process.stdout.write(`[bench-counts] ${name}=${result[name]} ms=${result[`${name}Ms`]}\n`);
  }
  writeFileSync(out, JSON.stringify(result));
}

performEffectWithEnvFile(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
