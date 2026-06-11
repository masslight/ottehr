/**
 * eval-whole-note.ts — score the ENTIRE easy-chart note (not just codes) for one case.
 *
 *   1. Run easy-chart-planner on the ambient transcript -> plan steps.
 *   2. Send (transcript, gold note, steps) to the easy-chart-eval-judge zambda (an LLM judge).
 *   3. Print a section-by-section scorecard: captured / missed / extra, where each miss is tagged
 *      [in transcript] (a real miss) vs [not in transcript] (PMH/exam-clicks/intake the scribe
 *      never hears). Plus 0-100 semantic scores for the free-text fields and a headline fidelity
 *      score computed over ONLY the transcript-derivable gold items.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/eval-whole-note.ts <caseNumber>
 *   (expects $EVAL_DIR/<n>.txt = gold note, <n>a.txt = transcript)
 */
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

const ZAMBDA_API = process.env.ZAMBDA_API_OVERRIDE || 'http://localhost:3000/local';

async function getToken(): Promise<string> {
  const r = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!r.ok) throw new Error(`auth failed: ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

async function callZambda(name: string, token: string, body: unknown): Promise<any> {
  const r = await fetch(`${ZAMBDA_API}/zambda/${name}/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-zapehr-project-id': need('PROJECT_ID'),
    },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${name} -> ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return j.output ?? j;
}

interface Captured {
  gold: string;
  asPlanned: string;
  exact: boolean;
  note?: string;
}
interface Missed {
  gold: string;
  inTranscript: boolean;
  note?: string;
}
interface Extra {
  planned: string;
  note?: string;
}
interface ScoreSection {
  name: string;
  captured: Captured[];
  missed: Missed[];
  extra: Extra[];
}
interface Scorecard {
  sections: ScoreSection[];
  freeText: { field: string; score: number; note?: string }[];
  fidelityScore: number;
  summary: string;
}

const OUT: string[] = [];
const out = (s = ''): void => {
  OUT.push(s);
};

function render(caseNum: string, card: Scorecard): void {
  out(`===== WHOLE-NOTE SCORE — CASE ${caseNum} =====`);
  out(`Fidelity (transcript-derivable gold items captured): ${Math.round(card.fidelityScore)}%`);
  out('');
  out(card.summary);

  for (const s of card.sections ?? []) {
    const total = s.captured.length + s.missed.length;
    if (total === 0 && s.extra.length === 0) continue;
    out(`\n── ${s.name} ──`);
    for (const c of s.captured) {
      out(`  ✓ ${c.gold}${c.exact ? '' : `  →  charted as ${c.asPlanned}${c.note ? ` (${c.note})` : ''}`}`);
    }
    for (const m of s.missed) {
      out(
        `  ✗ ${m.gold}   [${m.inTranscript ? 'IN TRANSCRIPT — real miss' : 'not in transcript'}]${
          m.note ? ` — ${m.note}` : ''
        }`
      );
    }
    for (const e of s.extra) {
      out(`  ⚠ EXTRA (not in gold): ${e.planned}${e.note ? ` — ${e.note}` : ''}`);
    }
  }

  if (card.freeText?.length) {
    out('\n── Free-text (semantic coverage) ──');
    for (const f of card.freeText) {
      out(`  ${String(Math.round(f.score)).padStart(3)}%  ${f.field}${f.note ? ` — ${f.note}` : ''}`);
    }
  }

  // Headline tallies
  let cap = 0;
  let realMiss = 0;
  let unhearable = 0;
  let extra = 0;
  for (const s of card.sections ?? []) {
    cap += s.captured.length;
    realMiss += s.missed.filter((m) => m.inTranscript).length;
    unhearable += s.missed.filter((m) => !m.inTranscript).length;
    extra += s.extra.length;
  }
  out(
    `\nTALLY: ${cap} captured · ${realMiss} real misses (in transcript) · ${unhearable} not-in-transcript · ${extra} extra/hallucinated`
  );
}

async function main(): Promise<void> {
  const caseNum = process.argv[2];
  if (!caseNum) {
    console.error('Usage: tsx eval-whole-note.ts <caseNumber>');
    process.exit(1);
  }
  const dir = process.env.EVAL_DIR || join(homedir(), 'Downloads', 'easychart');
  const goldNote = readFileSync(join(dir, `${caseNum}.txt`), 'utf-8');
  const transcript = readFileSync(join(dir, `${caseNum}a.txt`), 'utf-8');

  const token = await getToken();
  const planOut = await callZambda('easy-chart-planner', token, { narrative: transcript, noteContext: {} });
  const steps: unknown[] = planOut.steps ?? [];

  const card: Scorecard = await callZambda('easy-chart-eval-judge', token, {
    transcript,
    goldNote,
    plannerSteps: JSON.stringify(steps, null, 2),
  });

  render(caseNum, card);
  const report = OUT.join('\n');
  writeFileSync(join(dir, `${caseNum}.wholenote.txt`), report);
  process.stdout.write(report + '\n');
}

main().catch((e) => {
  process.stdout.write(OUT.join('\n') + '\n');
  console.error('EVAL ERROR:', e instanceof Error ? e.message : e);
  process.exit(1);
});
