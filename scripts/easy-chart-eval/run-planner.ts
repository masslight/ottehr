/**
 * run-planner.ts — feed an ambient-scribe transcript through the easy-chart-planner
 * (the easy-chart feature's brain) and print the ordered plan steps: diagnoses (+ICD-10),
 * exam findings, procedures, meds, E&M/CPT, and note-text edits.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/run-planner.ts <transcriptFile>
 */
import { readFileSync } from 'fs';

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx run-planner.ts <transcriptFile>');
    process.exit(1);
  }
  const narrative = readFileSync(file, 'utf-8');

  const tokenRes = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenRes.ok) throw new Error(`auth failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const res = await fetch('http://localhost:3000/local/zambda/easy-chart-planner/execute', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${access_token}`,
      'x-zapehr-project-id': need('PROJECT_ID'),
    },
    body: JSON.stringify({ narrative, noteContext: {} }),
  });
  console.log('HTTP', res.status);
  const j: any = await res.json();
  const out = j.output ?? j;
  const steps: any[] = out.steps ?? [];
  console.log(`PLAN: ${steps.length} steps\n`);

  for (const s of steps) {
    let d: string;
    if (s.kind === 'edit-note-text') {
      d = `${s.field}: "${(s.newText ?? '').slice(0, 140)}${(s.newText?.length ?? 0) > 140 ? '…' : ''}"`;
    } else if (s.kind === 'set-em-code' || s.kind === 'add-cpt' || s.kind === 'remove-cpt') {
      d = `code=${s.code} "${s.display ?? ''}"`;
    } else {
      d =
        `"${s.display ?? s.message ?? ''}"` +
        (s.code ? ` code=${s.code}` : '') +
        (s.isPrimary ? ' [PRIMARY]' : '') +
        (s.searchTerms ? ` terms=${JSON.stringify(s.searchTerms)}` : '');
    }
    console.log(`  [${s.kind}] ${d}`);
  }
  console.log('\n===== RAW JSON =====');
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
