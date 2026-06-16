/**
 * run-planner-batch.ts — run a directory of transcript files through the easy-chart-planner and
 * print a compact per-case summary of the charted plan (diagnoses +ICD, exam, ROS, meds, E&M,
 * note edits). Dumps full JSON per case to <outDir> for deeper review.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/run-planner-batch.ts <casesDir> [outDir]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function getToken(): Promise<string> {
  const res = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function planCase(narrative: string, token: string): Promise<any> {
  const res = await fetch('http://localhost:3000/local/zambda/easy-chart-planner/execute', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-zapehr-project-id': need('PROJECT_ID'),
    },
    body: JSON.stringify({ narrative, noteContext: {} }),
  });
  const j: any = await res.json();
  const out = j.output ?? j;
  return out.steps ?? [];
}

function summarize(steps: any[]): string {
  const lines: string[] = [];
  const get = (kind: string): any[] => steps.filter((s) => s.kind === kind);
  for (const s of get('apply-template')) lines.push(`  template: ${s.display}`);
  for (const s of get('add-diagnosis'))
    lines.push(`  dx${s.isPrimary ? ' [PRIMARY]' : ''}: ${s.display}${s.code ? ` (${s.code})` : ' (no code)'}`);
  for (const s of get('add-medication'))
    lines.push(`  med: ${s.display}${s.strength ? ` ${s.strength}` : ''}${s.doseForm ? ` ${s.doseForm}` : ''}`);
  const cpt = [...get('set-em-code'), ...get('add-cpt')];
  for (const s of cpt) lines.push(`  ${s.kind === 'set-em-code' ? 'E&M' : 'CPT'}: ${s.code}`);
  const exam = get('add-exam-finding').map((s) => s.display);
  if (exam.length) lines.push(`  exam: ${exam.join('; ')}`);
  const ros = get('add-ros-finding').map((s) => s.display);
  if (ros.length) lines.push(`  ros: ${ros.join('; ')}`);
  for (const s of get('add-procedure')) lines.push(`  procedure: ${s.display}`);
  for (const s of get('edit-note-text')) lines.push(`  note[${s.field}]: "${(s.newText ?? '').slice(0, 90)}…"`);
  const other = steps.filter(
    (s) =>
      ![
        'apply-template',
        'add-diagnosis',
        'add-medication',
        'set-em-code',
        'add-cpt',
        'add-exam-finding',
        'add-ros-finding',
        'add-procedure',
        'edit-note-text',
      ].includes(s.kind)
  );
  for (const s of other) lines.push(`  other[${s.kind}]: ${s.display ?? s.message ?? ''}`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  const casesDir = process.argv[2] ?? 'scripts/easy-chart-eval/urgent-care-cases';
  const outDir = process.argv[3] ?? '/tmp/uc-results';
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(casesDir)
    .filter((f) => f.endsWith('.txt'))
    .sort();
  const token = await getToken();

  // Run with limited concurrency (planner is gemini-flash-lite with backoff; keep it gentle).
  const CONCURRENCY = 4;
  const results: { file: string; steps: any[] }[] = new Array(files.length);
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < files.length) {
      const i = idx++;
      const file = files[i];
      const narrative = readFileSync(join(casesDir, file), 'utf8');
      try {
        const steps = await planCase(narrative, token);
        results[i] = { file, steps };
        writeFileSync(join(outDir, file.replace('.txt', '.json')), JSON.stringify(steps, null, 2));
        process.stderr.write(`done ${file} (${steps.length} steps)\n`);
      } catch (e) {
        results[i] = { file, steps: [] };
        process.stderr.write(`FAIL ${file}: ${e instanceof Error ? e.message : e}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  for (const r of results) {
    console.log(`\n===== ${r.file} (${r.steps.length} steps) =====`);
    console.log(summarize(r.steps));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
