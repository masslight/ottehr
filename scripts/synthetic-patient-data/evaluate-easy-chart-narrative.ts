/**
 * evaluate-easy-chart-narrative.ts — feed a narrative to the easy-chart-planner,
 * then for each `add-*` step run the same canonical search the EHR client would
 * run and print the top-N ranked matches. Lets us evaluate planner decomposition
 * quality and picker ranking quality end-to-end without driving the UI.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/synthetic-patient-data/evaluate-easy-chart-narrative.ts \
 *     <narrative-file> [topN=3]
 */
import Oystehr from '@oystehr/sdk';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const narrativePath = args.find((a) => !a.startsWith('--')) ?? '';
const topN = parseInt(args.find((a) => a.startsWith('top='))?.split('=')[1] ?? '3', 10);

if (!narrativePath) {
  console.error('Usage: tsx evaluate-easy-chart-narrative.ts <narrative-file> [top=N]');
  process.exit(1);
}

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

// Note: searchMedications / searchAllergens helpers were removed — the eRx endpoints require
// a user token (not the M2M token we have here), so we just print the intent shape for
// medication/allergy steps. The ranker logic is verified against the client UI separately.

async function searchIcd10(oystehr: Oystehr, intent: any, narrowToN: number): Promise<any[]> {
  // Mirror the client's code-first lookup so the eval reflects what the picker will actually show.
  if (intent.code) {
    const codeRes = await (oystehr as any).zambda.execute({ id: 'icd-10-search', search: intent.code });
    const codeCodes = codeRes?.output?.codes ?? codeRes?.codes ?? [];
    const exact = codeCodes.find((c: any) => c.code.toLowerCase() === intent.code.toLowerCase());
    if (exact) return [{ name: exact.display, code: exact.code, _autoPick: true }];
  }
  const terms: string[] = intent.searchTerms?.length ? intent.searchTerms : [intent.display];
  const res = await (oystehr as any).zambda.execute({ id: 'icd-10-search', search: terms[0] });
  const codes = res?.output?.codes ?? res?.codes ?? [];
  return codes.slice(0, narrowToN).map((c: any) => ({ name: c.display, code: c.code }));
}

async function main(): Promise<void> {
  const narrative = readFileSync(narrativePath, 'utf-8');
  console.log('=== NARRATIVE ===');
  console.log(narrative.slice(0, 200) + '...\n');

  // Get M2M token
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
  if (!tokenRes.ok) throw new Error(`auth: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // The local zambdas server runs at localhost:3000 with route /local/zambda/<name>/execute.
  const zambdaApi = process.env.ZAMBDA_API_OVERRIDE || 'http://localhost:3000/local';

  // Step 1: call the planner zambda
  console.log('=== PLANNER OUTPUT ===');
  const plannerRes = await fetch(`${zambdaApi}/zambda/easy-chart-planner/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${access_token}`,
      'x-zapehr-project-id': need('PROJECT_ID'),
    },
    body: JSON.stringify({ narrative, noteContext: {} }),
  });
  if (!plannerRes.ok) {
    console.error(`planner failed: ${plannerRes.status} ${await plannerRes.text()}`);
    process.exit(1);
  }
  const plannerData = (await plannerRes.json()) as { output?: { steps?: any[] } };
  const steps: any[] = plannerData.output?.steps ?? [];
  console.log(`Plan: ${steps.length} steps`);
  steps.forEach((s, i) => {
    const detail =
      s.kind === 'edit-note-text'
        ? `${s.field}: "${(s.newText ?? '').slice(0, 80)}${(s.newText?.length ?? 0) > 80 ? '...' : ''}"`
        : s.kind === 'update-procedure'
        ? `updates=${JSON.stringify(s.updates)}`
        : s.kind === 'set-em-code' || s.kind === 'add-cpt' || s.kind === 'remove-cpt'
        ? `code=${s.code} display="${s.display}"`
        : `display="${s.display ?? s.message ?? ''}" searchTerms=${JSON.stringify(s.searchTerms ?? [])}${
            s.code ? ` code="${s.code}"` : ''
          }${s.strength ? ` strength="${s.strength}"` : ''}${s.doseForm ? ` doseForm="${s.doseForm}"` : ''}`;
    console.log(`  ${i + 1}. [${s.kind}] ${detail}`);
  });
  console.log('');

  // Step 2: for each add-* step, run the search and show top-N
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  console.log(`=== PICKER PREVIEWS (top ${topN} per step) ===`);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    let preview: any[] = [];
    try {
      // erx searches require a user token, not M2M — skip them in this CLI eval. The
      // ranker logic was validated separately in the UI test on Maya.
      if (s.kind === 'add-medication') {
        console.log(
          `  Step ${i + 1} [${s.kind}] "${s.display}" — searchTerms=${JSON.stringify(s.searchTerms ?? [])}${
            s.strength ? ` strength="${s.strength}"` : ''
          }${s.doseForm ? ` doseForm="${s.doseForm}"` : ''}`
        );
        console.log('    (erx search requires user token; planner intent shape shown above)');
        continue;
      }
      if (s.kind === 'add-allergy') {
        console.log(`  Step ${i + 1} [${s.kind}] "${s.display}" — searchTerms=${JSON.stringify(s.searchTerms ?? [])}`);
        console.log('    (erx search requires user token)');
        continue;
      }
      if (s.kind === 'add-diagnosis' || s.kind === 'add-condition') preview = await searchIcd10(oystehr, s, topN);
      else continue;
    } catch (e) {
      console.log(`  Step ${i + 1} [${s.kind}] ERROR: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    console.log(`  Step ${i + 1} [${s.kind}] "${s.display}"`);
    if (preview.length === 0) {
      console.log(`    (no matches)`);
    } else {
      preview.forEach((r, j) => {
        const detail = [r.name, r.strength ? `(${r.strength})` : '', r.code ? `[${r.code}]` : '']
          .filter(Boolean)
          .join(' ');
        console.log(`    ${j + 1}. ${detail}`);
      });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
