/**
 * judge-freetext.ts — offline LLM judge for predicted vs gold free-text note content, per case,
 * over the two narrative sections that matter clinically:
 *   - historyOfPresentIllness
 *   - medicalDecisionMaking
 * Field pairing comes from score-harvested's FREETEXT_PAIRING (the CC/HPI storage cross-wiring —
 * the model writes the real HPI via the 'historyOfPresentIllness' note field and MDM via
 * 'medicalDecision'), so this judge can never disagree with the presence scorer about which
 * fields pair up.
 *
 * Per section, one structured call per case (claude-sonnet-5, forced tool_use, thinking
 * disabled — shared claudeStructured/coerceArrayField from tag-voiced.ts) scores CONTENT only:
 *   coverage    0-2 — how much of the gold section's clinical content the prediction carries
 *               (null when the gold section is empty — nothing to cover)
 *   fabrication 0-2 — 2 = no unsupported clinical claims; a claim is supported when it appears
 *               in the GOLD note OR the TRANSCRIPT (passed for exactly this reason); null when
 *               the prediction is empty. Style/format/length are never judged.
 * plus a one-line rationale each (file-only — stdout carries scores, never clinical text).
 *
 * Outputs: caseNNN.freetext.json per case in the results dir; freetext-summary.json aggregate
 * (rebuilt from ALL freetext files present, so partial reruns stay consistent).
 *
 * Usage (needs ANTHROPIC_API_KEY except in --dry-run):
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/judge-freetext.ts [resultsDir] [casesDir] [flags]
 *   resultsDir defaults to scripts/easy-chart-eval/harvested-results (pass run2/run3 dirs etc.),
 *   casesDir to scripts/easy-chart-eval/harvested-cases.
 *
 * Flags:
 *   --dry-run            enumerate cases + per-section gold/pred presence, exit before any API
 *                        call (no key needed).
 *   --force              re-judge cases whose caseNNN.freetext.json already exists.
 *   --cases=case002,...  limit to specific caseIds (e.g. to retry judge failures).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { GoldData } from './harvest-shared';
import { FREETEXT_PAIRING, SimFinalState } from './score-harvested';
import { claudeStructured, coerceArrayField, JUDGE_MODEL } from './tag-voiced';

const SECTIONS = ['historyOfPresentIllness', 'medicalDecisionMaking'] as const;
type SectionName = (typeof SECTIONS)[number];

// ---------------------------------------------------------------------------
// Per-case inputs
// ---------------------------------------------------------------------------
interface SectionInput {
  name: SectionName;
  goldText?: string;
  predText?: string;
}

function sectionInputs(gold: GoldData, finalState: SimFinalState): SectionInput[] {
  return SECTIONS.map((name) => {
    const pairing = FREETEXT_PAIRING[name];
    const goldText = (gold[pairing.goldField] ?? '').trim() || undefined;
    const predText = (finalState.noteText?.[pairing.noteField]?.text ?? '').trim() || undefined;
    return { name, goldText, predText };
  });
}

// ---------------------------------------------------------------------------
// LLM judge
// ---------------------------------------------------------------------------
const TOOL_NAME = 'emit_freetext_judgments';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string', enum: [...SECTIONS] },
          coverage: {
            type: 'integer',
            minimum: 0,
            maximum: 2,
            description: '0 = most gold facts missing, 1 = partial, 2 = all or nearly all gold facts present',
          },
          fabrication: {
            type: 'integer',
            minimum: 0,
            maximum: 2,
            description:
              '2 = no unsupported claims, 1 = minor unsupported detail(s), 0 = significant unsupported clinical claim(s); supported = present in GOLD or TRANSCRIPT',
          },
          rationale: { type: 'string', description: 'one line, content-focused' },
        },
        required: ['section', 'coverage', 'fabrication', 'rationale'],
      },
    },
  },
  required: ['sections'],
};

function buildPrompt(transcript: string, sections: SectionInput[]): string {
  const blocks = sections
    .map(
      (s) =>
        `SECTION ${s.name}\nGOLD:\n"""\n${s.goldText ?? '(empty)'}\n"""\nPREDICTED:\n"""\n${
          s.predText ?? '(empty)'
        }\n"""`
    )
    .join('\n\n');
  return (
    `You are grading an AI ambient scribe's free-text note sections against the provider's own ` +
    `signed note (GOLD) for the same visit. The raw dictation TRANSCRIPT is additional ground ` +
    `truth: a predicted claim grounded in the transcript is NOT a fabrication even when the ` +
    `gold note omits it.\n\n` +
    `For EACH section below return two integer scores (0-2) and a one-line rationale:\n` +
    `- coverage: how much of the GOLD section's clinical content appears in PREDICTED ` +
    `(0 = most gold facts missing, 1 = partial, 2 = all or nearly all gold facts present). ` +
    `When GOLD is (empty), return 2 — it is ignored downstream.\n` +
    `- fabrication: unsupported clinical claims in PREDICTED. A claim is supported when it ` +
    `appears in GOLD or in the TRANSCRIPT (stated or clearly implied). 2 = no unsupported ` +
    `claims, 1 = minor unsupported detail(s), 0 = one or more significant unsupported clinical ` +
    `claims.\n` +
    `Judge CONTENT only — never style, formatting, ordering, tone, or length.\n\n` +
    `TRANSCRIPT:\n"""\n${transcript}\n"""\n\n${blocks}`
  );
}

interface SectionJudgment {
  goldPresent: boolean;
  predictedPresent: boolean;
  coverage: number | null;
  fabrication: number | null;
  rationale: string;
}

const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 2;

async function judgeCaseSections(
  transcript: string,
  sections: SectionInput[],
  apiKey: string
): Promise<Record<SectionName, SectionJudgment>> {
  const out = {} as Record<SectionName, SectionJudgment>;
  // Degenerate sections are settled locally; only sections with predicted text go to the judge.
  const toJudge = sections.filter((s) => s.predText);
  for (const s of sections) {
    if (!s.predText) {
      out[s.name] = {
        goldPresent: !!s.goldText,
        predictedPresent: false,
        coverage: s.goldText ? 0 : null, // gold present + nothing predicted = zero coverage
        fabrication: null, // nothing predicted → nothing to fabricate
        rationale: s.goldText
          ? 'predicted section empty — coverage 0 by definition'
          : 'both sections empty — not judged',
      };
    }
  }
  if (toJudge.length === 0) return out;

  const input = await claudeStructured(buildPrompt(transcript, toJudge), RESPONSE_SCHEMA, TOOL_NAME, apiKey);
  const raw = coerceArrayField(input, 'sections') as {
    section?: string;
    coverage?: number;
    fabrication?: number;
    rationale?: string;
  }[];
  for (const s of toJudge) {
    const j = raw.find((r) => r.section === s.name);
    if (!j || !isScore(j.coverage) || !isScore(j.fabrication)) {
      throw new Error(`judge returned no valid scores for section ${s.name}`);
    }
    out[s.name] = {
      goldPresent: !!s.goldText,
      predictedPresent: true,
      coverage: s.goldText ? j.coverage : null, // empty gold → coverage meaningless (judge told to emit 2)
      fabrication: j.fabrication,
      rationale: (j.rationale ?? '').trim() || '(no rationale)',
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregate — rebuilt from ALL caseNNN.freetext.json present in the results dir.
// ---------------------------------------------------------------------------
interface FreetextFile {
  caseId: string;
  model: string;
  judgedAt: string;
  sections: Record<SectionName, SectionJudgment>;
}

function rebuildSummary(resultsDir: string): void {
  const files = readdirSync(resultsDir)
    .filter((f) => /^case\d+\.freetext\.json$/.test(f))
    .sort();
  const judged = files.map((f) => JSON.parse(readFileSync(join(resultsDir, f), 'utf8')) as FreetextFile);
  const summary = {
    judgedCases: judged.length,
    sections: {} as Record<
      SectionName,
      {
        goldPresent: number;
        predictedPresent: number;
        coverageJudged: number;
        coverageMean: number | null;
        fabricationJudged: number;
        fabricationMean: number | null;
        fabricationFlagged: number; // sections judged < 2 (any unsupported claim)
      }
    >,
  };
  for (const name of SECTIONS) {
    const rows = judged.map((c) => c.sections[name]).filter(Boolean);
    const cov = rows.map((r) => r.coverage).filter((v): v is number => v != null);
    const fab = rows.map((r) => r.fabrication).filter((v): v is number => v != null);
    summary.sections[name] = {
      goldPresent: rows.filter((r) => r.goldPresent).length,
      predictedPresent: rows.filter((r) => r.predictedPresent).length,
      coverageJudged: cov.length,
      coverageMean: cov.length > 0 ? cov.reduce((a, b) => a + b, 0) / cov.length : null,
      fabricationJudged: fab.length,
      fabricationMean: fab.length > 0 ? fab.reduce((a, b) => a + b, 0) / fab.length : null,
      fabricationFlagged: fab.filter((v) => v < 2).length,
    };
  }
  writeFileSync(join(resultsDir, 'freetext-summary.json'), JSON.stringify(summary, null, 2));

  const fmtMean = (v: number | null): string => (v === null ? '   —' : v.toFixed(2));
  console.log(`\nfreetext-summary.json rebuilt from ${judged.length} freetext files in ${resultsDir}`);
  console.log('section                    gold  pred  covN  covMean  fabN  fabMean  fabFlagged');
  for (const name of SECTIONS) {
    const s = summary.sections[name];
    console.log(
      `${name.padEnd(26)} ${String(s.goldPresent).padStart(4)} ${String(s.predictedPresent).padStart(5)} ${String(
        s.coverageJudged
      ).padStart(5)} ${fmtMean(s.coverageMean).padStart(8)} ${String(s.fabricationJudged).padStart(5)} ${fmtMean(
        s.fabricationMean
      ).padStart(8)} ${String(s.fabricationFlagged).padStart(11)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
interface ResultFile {
  caseId?: string;
  error?: string;
  finalState?: SimFinalState;
}

const fmtScore = (v: number | null): string => (v === null ? '—' : String(v));
const caseLine = (caseId: string, sections: Record<SectionName, SectionJudgment>): string =>
  `${caseId}: HPI cov ${fmtScore(sections.historyOfPresentIllness.coverage)} fab ${fmtScore(
    sections.historyOfPresentIllness.fabrication
  )} | MDM cov ${fmtScore(sections.medicalDecisionMaking.coverage)} fab ${fmtScore(
    sections.medicalDecisionMaking.fabrication
  )}`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));
  const resultsDir = positional[0] ?? 'scripts/easy-chart-eval/harvested-results';
  const casesDir = positional[1] ?? 'scripts/easy-chart-eval/harvested-cases';
  const dryRun = flags.includes('--dry-run');
  const force = flags.includes('--force');
  const casesFlag = flags.find((f) => f.startsWith('--cases='));
  const only = casesFlag
    ? new Set(
        casesFlag
          .slice('--cases='.length)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    : undefined;

  let resultFiles = readdirSync(resultsDir)
    .filter((f) => /^case\d+\.result\.json$/.test(f))
    .sort();
  if (only) resultFiles = resultFiles.filter((f) => only.has(f.replace('.result.json', '')));
  console.log(
    `${resultFiles.length} result files in ${resultsDir}${only ? ' (--cases filter active)' : ''}${
      dryRun ? ' [DRY RUN]' : ''
    }`
  );

  // Enumerate eligible cases (shared by dry-run and real run).
  interface Eligible {
    caseId: string;
    transcript: string;
    sections: SectionInput[];
  }
  const eligible: Eligible[] = [];
  for (const f of resultFiles) {
    const caseId = f.replace('.result.json', '');
    const result = JSON.parse(readFileSync(join(resultsDir, f), 'utf8')) as ResultFile;
    if (result.error || !result.finalState) {
      console.log(`${caseId}: skipped (result has recorded error — no finalState to judge)`);
      continue;
    }
    const casePath = join(casesDir, `${caseId}.json`);
    if (!existsSync(casePath)) {
      console.log(`${caseId}: skipped (no case file in ${casesDir})`);
      continue;
    }
    const caseJson = JSON.parse(readFileSync(casePath, 'utf8')) as { transcript: string; gold: GoldData };
    const sections = sectionInputs(caseJson.gold, result.finalState);
    const already = existsSync(join(resultsDir, `${caseId}.freetext.json`));
    if (already && !force) {
      console.log(`${caseId}: already judged (skipped; use --force to re-judge)`);
      continue;
    }
    if (dryRun) {
      const desc = sections
        .map(
          (s) =>
            `${s.name === 'historyOfPresentIllness' ? 'HPI' : 'MDM'} gold:${s.goldText ? 'y' : '-'} pred:${
              s.predText ? 'y' : '-'
            }`
        )
        .join(', ');
      const needsLlm = sections.some((s) => s.predText);
      console.log(
        `${caseId}: ${desc} — ${needsLlm ? 'WOULD judge (1 LLM call)' : 'degenerate (no LLM call needed)'}${
          already ? ' [re-judge via --force]' : ''
        }`
      );
    }
    eligible.push({ caseId, transcript: caseJson.transcript, sections });
  }

  if (dryRun) {
    console.log(`\ndry run: ${eligible.length} cases would be judged. No API calls made.`);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error(
      'Missing env: ANTHROPIC_API_KEY (run under `npx env-cmd -f packages/zambdas/.env/local.json`, or use --dry-run)'
    );

  const CONCURRENCY = 3;
  let failed = 0;
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < eligible.length) {
      const i = idx++;
      const c = eligible[i];
      try {
        const sections = await judgeCaseSections(c.transcript, c.sections, apiKey!);
        const out: FreetextFile = {
          caseId: c.caseId,
          model: JUDGE_MODEL,
          judgedAt: new Date().toISOString(),
          sections,
        };
        writeFileSync(join(resultsDir, `${c.caseId}.freetext.json`), JSON.stringify(out, null, 2));
        console.log(caseLine(c.caseId, sections));
      } catch (e) {
        failed++;
        console.log(`${c.caseId}: FAILED (${e instanceof Error ? e.message : String(e)})`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  rebuildSummary(resultsDir);
  console.log(
    `\ndone: ${eligible.length - failed} ok, ${failed} failed${
      failed > 0 ? ' — rerun with --cases=<failed ids> to retry' : ''
    }`
  );
  if (failed > 0) process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
