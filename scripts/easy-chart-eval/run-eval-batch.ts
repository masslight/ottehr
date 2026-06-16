/**
 * run-eval-batch.ts — for each transcript in a directory: run the easy-chart-planner, synthesize a
 * chartState from the plan, then run the easy-chart-review over (narrative + chartState) and print
 * what the review pass flags. Exercises the full charting → review flow end to end.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/run-eval-batch.ts <casesDir>
 */
import { readdirSync, readFileSync } from 'fs';
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

async function callZambda(name: string, body: any, token: string): Promise<any> {
  const res = await fetch(`http://localhost:3000/local/zambda/${name}/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-zapehr-project-id': need('PROJECT_ID'),
    },
    body: JSON.stringify(body),
  });
  const j: any = await res.json();
  return j.output ?? j;
}

function chartStateFromSteps(steps: any[]): string {
  const lines: string[] = [];
  const pick = (k: string): any[] => steps.filter((s) => s.kind === k);
  const tmpl = pick('apply-template').map((s) => s.display);
  if (tmpl.length) lines.push(`Template applied: ${tmpl.join('; ')} (may add its own default diagnosis/exam/MDM)`);
  const dx = pick('add-diagnosis').map(
    (s) => `${s.display}${s.code ? ` (${s.code})` : ''}${s.isPrimary ? ' [PRIMARY]' : ''}`
  );
  if (dx.length) lines.push(`Diagnoses: ${dx.join('; ')}`);
  const exam = pick('add-exam-finding').map((s) => s.display);
  if (exam.length) lines.push(`Exam findings: ${exam.join('; ')}`);
  const ros = pick('add-ros-finding').map((s) => s.display);
  if (ros.length) lines.push(`ROS: ${ros.join('; ')}`);
  const meds = pick('add-medication').map((s) => `${s.display}${s.strength ? ` ${s.strength}` : ''}`);
  if (meds.length) lines.push(`Medications: ${meds.join('; ')}`);
  const em = pick('set-em-code').map((s) => s.code);
  if (em.length) lines.push(`E&M: ${em.join(', ')}`);
  for (const n of pick('edit-note-text')) lines.push(`${n.field}: ${(n.newText ?? '').slice(0, 400)}`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  const casesDir = process.argv[2] ?? 'scripts/easy-chart-eval/urgent-care-cases';
  const files = readdirSync(casesDir)
    .filter((f) => f.endsWith('.txt'))
    .sort();
  const token = await getToken();

  const CONCURRENCY = 4;
  const out: { file: string; suggestions: any[] }[] = new Array(files.length);
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < files.length) {
      const i = idx++;
      const file = files[i];
      const narrative = readFileSync(join(casesDir, file), 'utf8');
      try {
        const plan = await callZambda('easy-chart-planner', { narrative, noteContext: {} }, token);
        const chartState = chartStateFromSteps(plan.steps ?? []);
        const review = await callZambda('easy-chart-review', { narrative, chartState }, token);
        out[i] = { file, suggestions: review.suggestions ?? [] };
        process.stderr.write(`done ${file} (${(review.suggestions ?? []).length} suggestions)\n`);
      } catch (e) {
        out[i] = { file, suggestions: [] };
        process.stderr.write(`FAIL ${file}: ${e instanceof Error ? e.message : e}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  for (const r of out) {
    console.log(`\n===== ${r.file} — ${r.suggestions.length} review suggestion(s) =====`);
    for (const s of r.suggestions) {
      console.log(`  [${s.category}] ${s.question}`);
      for (const a of s.actions ?? []) {
        const bit = [a.kind, a.display, a.code].filter(Boolean).join(' · ');
        console.log(`      → ${bit}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
