/**
 * eval-case.ts — headless easy-chart evaluation for one case (template-aware).
 *
 * Reproduces the accuracy-critical part of the easy-chart flow WITHOUT the browser or any
 * FHIR writes:
 *   1. Run easy-chart-planner on the ambient transcript -> ordered plan steps.
 *   2. Build the "effective coded chart" the plan would produce:
 *        - apply-template step  -> fetch template detail; its diagnoses / cptCodes / emCode
 *          land on the chart directly.
 *        - add-diagnosis / add-condition step -> replicate the EHR's ICD-10 resolution
 *          (code-first, else text by display then searchTerms) and take the top candidate;
 *          also record whether the clinician's exact code is REACHABLE in the candidate list.
 *   3. Compare the effective chart's codes against the codes the clinician charted
 *      (parsed from the note) and report reachable / missing per code.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/eval-case.ts <caseNumber> [topN=15]
 *   (expects ~/Downloads/easychart/<n>.txt = note, <n>a.txt = transcript)
 */
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const OUT: string[] = [];
function out(s = ''): void {
  OUT.push(s);
}

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

const ICD10_RE = /\b([A-TV-Z]\d[A-Z0-9](?:\.[A-Z0-9]{1,4})?)\b/g;
const CPT_RE = /\b(\d{5})\b/g;
const HCPCS_RE = /\b([A-V]\d{4})\b/g;

function extractExpectedCodes(note: string): { icd10: string[]; cpt: string[]; hcpcs: string[] } {
  return {
    icd10: [...new Set(note.match(ICD10_RE) ?? [])],
    cpt: [...new Set(note.match(CPT_RE) ?? [])],
    hcpcs: [...new Set(note.match(HCPCS_RE) ?? [])],
  };
}

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

const ZAMBDA_API = process.env.ZAMBDA_API_OVERRIDE || 'http://localhost:3000/local';

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
  if (!r.ok) throw new Error(`${name} -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.output ?? j;
}

// Replicate runIntentSearch's ICD resolution: code-first, then text by display+searchTerms.
async function resolveIcdCandidates(
  token: string,
  step: any,
  topN: number
): Promise<{ codeFirstHit?: string; candidates: { code: string; display: string }[] }> {
  const terms: string[] = [];
  if (step.display) terms.push(step.display);
  if (Array.isArray(step.searchTerms)) terms.push(...step.searchTerms);

  if (typeof step.code === 'string' && step.code.trim()) {
    const resp = await callZambda('icd-10-search', token, { search: step.code.trim() });
    const exact = (resp?.codes ?? []).find((c: any) => c.code.toLowerCase() === step.code.trim().toLowerCase());
    if (exact) return { codeFirstHit: exact.code, candidates: [exact] };
  }

  const seen = new Set<string>();
  const candidates: { code: string; display: string }[] = [];
  for (const term of terms) {
    if (!term) continue;
    const resp = await callZambda('icd-10-search', token, { search: term });
    for (const c of resp?.codes ?? []) {
      if (!seen.has(c.code)) {
        seen.add(c.code);
        candidates.push(c);
      }
    }
    if (candidates.length >= topN) break;
  }
  return { candidates: candidates.slice(0, topN) };
}

async function fetchTemplateDetail(token: string, title: string): Promise<any | undefined> {
  const list = await callZambda('list-templates', token, { includeVersionData: false });
  const templates: any[] = list?.templates ?? [];
  const match = templates.find((t) => (t.title ?? '').toLowerCase() === title.toLowerCase());
  if (!match) return undefined;
  return callZambda('admin-get-template-detail', token, { templateId: match.id });
}

async function main(): Promise<void> {
  const caseNum = process.argv[2];
  const topN = parseInt(process.argv[3] ?? '15', 10);
  if (!caseNum) {
    console.error('Usage: tsx eval-case.ts <caseNumber> [topN=15]');
    process.exit(1);
  }
  const dir = process.env.EVAL_DIR || join(homedir(), 'Downloads', 'easychart');
  const note = readFileSync(join(dir, `${caseNum}.txt`), 'utf-8');
  const transcript = readFileSync(join(dir, `${caseNum}a.txt`), 'utf-8');
  const expected = extractExpectedCodes(note);

  out(`===== CASE ${caseNum} =====`);
  out(`Expected ICD-10:  ${expected.icd10.join(', ') || '(none)'}`);
  out(`Expected CPT:     ${expected.cpt.join(', ') || '(none)'}`);
  out(`Expected HCPCS:   ${expected.hcpcs.join(', ') || '(none)'}`);

  const token = await getToken();

  // ---- plan ----
  const planOut = await callZambda('easy-chart-planner', token, { narrative: transcript, noteContext: {} });
  const steps: any[] = planOut.steps ?? [];
  out('\n--- PLAN ---');
  steps.forEach((s, i) => {
    const extra = s.code ? ` code=${s.code}` : s.searchTerms ? ` terms=${JSON.stringify(s.searchTerms)}` : '';
    out(`  ${i + 1}. [${s.kind}] ${s.display ?? s.field ?? ''}${extra}${s.isPrimary ? ' [PRIMARY]' : ''}`);
  });

  // ---- build effective coded chart ----
  const effIcd = new Map<string, string>(); // code -> source
  const effCpt = new Map<string, string>();
  const effEm = new Map<string, string>();
  const reachableIcd = new Set<string>(); // clinician codes reachable via a search picker

  out('\n--- EFFECTIVE CODED CHART (what the plan would put on the chart) ---');

  for (const s of steps) {
    if (s.kind === 'apply-template') {
      const detail = await fetchTemplateDetail(token, s.display);
      if (!detail) {
        out(`  apply-template "${s.display}": TEMPLATE NOT FOUND`);
        continue;
      }
      const sec = detail.sections ?? {};
      out(`  apply-template "${s.display}" carries:`);
      for (const d of sec.diagnoses ?? []) {
        effIcd.set(d.code, `template:${s.display}`);
        out(`    dx  ${d.code}  ${d.display}`);
      }
      for (const c of sec.cptCodes ?? []) {
        effCpt.set(c.code, `template:${s.display}`);
        out(`    cpt ${c.code}  ${c.display}`);
      }
      if (sec.emCode) {
        effEm.set(sec.emCode.code, `template:${s.display}`);
        out(`    E&M ${sec.emCode.code}  ${sec.emCode.display}`);
      }
      if (!(sec.diagnoses ?? []).length && !(sec.cptCodes ?? []).length && !sec.emCode) {
        out('    (no coded dx/cpt/em in template)');
      }
    } else if (s.kind === 'add-diagnosis' || s.kind === 'add-condition') {
      const { codeFirstHit, candidates } = await resolveIcdCandidates(token, s, topN);
      const chosen = codeFirstHit ?? candidates[0]?.code;
      if (chosen) {
        effIcd.set(chosen, `${s.kind}:"${s.display}"`);
        out(`  ${s.kind} "${s.display}" -> picks ${chosen} (${candidates[0]?.display ?? 'code-first'})`);
      } else {
        out(`  ${s.kind} "${s.display}" -> no candidates`);
      }
      for (const c of candidates) if (expected.icd10.includes(c.code)) reachableIcd.add(c.code);
      if (codeFirstHit && expected.icd10.includes(codeFirstHit)) reachableIcd.add(codeFirstHit);
    } else if (s.kind === 'set-em-code') {
      effEm.set(s.code, 'set-em-code');
      out(`  set-em-code ${s.code} ${s.display ?? ''}`);
    } else if (s.kind === 'add-cpt') {
      effCpt.set(s.code, 'add-cpt');
      out(`  add-cpt ${s.code} ${s.display ?? ''}`);
    }
  }

  // ---- compare ----
  const cmp = (label: string, expectedCodes: string[], eff: Map<string, string>): void => {
    out(`\n--- ${label} ---`);
    if (!expectedCodes.length) {
      out('  (none expected)');
      return;
    }
    for (const code of expectedCodes) {
      if (eff.has(code)) out(`  ${code}: ON CHART ✓  (${eff.get(code)})`);
      else if (label.startsWith('ICD') && reachableIcd.has(code))
        out(`  ${code}: not auto-selected, but REACHABLE in picker ⚠`);
      else out(`  ${code}: MISSING ✗`);
    }
  };
  cmp('ICD-10 (diagnoses)', expected.icd10, effIcd);
  cmp('CPT', expected.cpt, effCpt);
  cmp(
    'E&M / HCPCS',
    [...expected.cpt.filter((c) => /^99\d{3}$/.test(c)), ...expected.hcpcs],
    new Map([...effEm, ...effCpt])
  );

  const report = OUT.join('\n');
  writeFileSync(join(dir, `${caseNum}.eval.txt`), report);
  process.stdout.write(report + '\n');
}

main().catch((e) => {
  process.stdout.write(OUT.join('\n') + '\n');
  console.error('EVAL ERROR:', e instanceof Error ? e.message : e);
  process.exit(1);
});
