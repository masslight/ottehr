//   npx tsx src/scripts/adhoc-bench.ts <env> <startISO> <endISO> <layers,comma,separated> <out.json>
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { fetchAdHocEncounterRows } from '../shared/adhoc-datasets/encounters';
import * as adhocReport from '../shared/adhoc-report';
import { getAuth0Token } from '../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../shared/helpers';
import { performEffectWithEnvFile } from './helpers';

const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
    ? Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .sort()
          .map((key) => [key, stable((value as Record<string, unknown>)[key])])
      )
    : value;

const sha = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');

const REPORT_BUDGET_MS = 13 * 60 * 1000;

let networkRetries = 0;
const plainFetch = globalThis.fetch;
globalThis.fetch = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): Promise<Response> => {
  const request = input instanceof Request ? input : undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      return await plainFetch(request ? request.clone() : input, init);
    } catch (error) {
      if (attempt >= 4 || (error as { name?: string })?.name === 'AbortError') throw error;
      networkRetries++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
};

async function main(config: Record<string, string>): Promise<void> {
  const [, , , start, end, layers, out] = process.argv;
  const token = await getAuth0Token(config as never);
  if (!token) throw new Error('no token');
  const oystehr = createClinicalOystehrClient(token, config as never);

  const include = Object.fromEntries(
    layers
      .split(',')
      .filter(Boolean)
      .map((id) => [`include${id.charAt(0).toUpperCase()}${id.slice(1)}`, true])
  );

  const startedAt = Date.now();
  const rows = (await fetchAdHocEncounterRows(oystehr, { dateRange: { start, end }, ...include } as never, {
    environment: config.ENVIRONMENT ?? '',
  })) as unknown as Record<string, unknown>[];
  const ms = Date.now() - startedAt;

  const sorted = [...rows].sort((a, b) => String(a.encounterId).localeCompare(String(b.encounterId)));
  const fields = Array.from(new Set(sorted.flatMap((row) => Object.keys(row)))).sort();

  writeFileSync(
    out,
    JSON.stringify({
      ms,
      idsPerSearch: (adhocReport as Record<string, unknown>).IDS_PER_ENTRY,
      jobsInParallel: (adhocReport as Record<string, unknown>).JOBS_IN_PARALLEL,
      overBudget: ms > REPORT_BUDGET_MS,
      networkRetries,
      rows: rows.length,
      fingerprint: sha(sorted),
      fields: Object.fromEntries(
        fields.map((field) => [field, sha(sorted.map((row) => [row.encounterId, row[field]]))])
      ),
    })
  );
  console.log(
    `[bench] rows=${rows.length} ms=${ms} networkRetries=${networkRetries} ` +
      `idsPerSearch=${(adhocReport as Record<string, unknown>).IDS_PER_ENTRY} ` +
      `jobsInParallel=${(adhocReport as Record<string, unknown>).JOBS_IN_PARALLEL}`
  );
}

performEffectWithEnvFile(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
