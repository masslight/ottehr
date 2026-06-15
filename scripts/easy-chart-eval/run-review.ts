/**
 * run-review.ts — feed an ambient-scribe transcript (+ optional chart-state summary) through the
 * easy-chart-review zambda and print the post-completion SUGGESTION cards: med-name fixes,
 * diagnosis specificity swaps, missing pertinent negatives, E&M level changes, secondary dx.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/run-review.ts <transcriptFile> [chartStateFile]
 */
import { readFileSync } from 'fs';

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function main(): Promise<void> {
  const [file, chartStateFile] = process.argv.slice(2);
  if (!file) {
    console.error('Usage: tsx run-review.ts <transcriptFile> [chartStateFile]');
    process.exit(1);
  }
  const narrative = readFileSync(file, 'utf-8');
  const chartState = chartStateFile ? readFileSync(chartStateFile, 'utf-8') : undefined;

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

  const res = await fetch('http://localhost:3000/local/zambda/easy-chart-review/execute', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${access_token}`,
      'x-zapehr-project-id': need('PROJECT_ID'),
    },
    body: JSON.stringify({ narrative, chartState }),
  });
  console.log('HTTP', res.status);
  const j: any = await res.json();
  const out = j.output ?? j;
  const suggestions: any[] = out.suggestions ?? [];
  console.log(`REVIEW: ${suggestions.length} suggestions\n`);

  for (const s of suggestions) {
    console.log(`  [${s.category}] ${s.question}`);
    if (s.rationale) console.log(`      rationale: ${s.rationale}`);
    if (s.highlight) console.log(`      highlight: ${s.highlight}`);
    if (s.partial) console.log(`      partial: ${s.partialNote ?? 'yes'}`);
    for (const a of s.actions ?? []) {
      const bits = [a.kind, a.display, a.code, a.field, a.newText ? `"${String(a.newText).slice(0, 80)}…"` : '']
        .filter(Boolean)
        .join(' · ');
      console.log(`      → ${bits}`);
    }
  }
  console.log('\n===== RAW JSON =====');
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
