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
 * disabled — shared claudeStructured/coerceArrayField from tag-voiced.ts) scores CONTENT only
 * (criteriaVersion 2 — same lesson as the structured sections' voiced-scoping):
 *   coverage          0-2 — of the gold facts that are stated or clearly implied IN THE
 *                     TRANSCRIPT, how many appear in predicted. Gold content with no transcript
 *                     basis (prior-chart knowledge, discharge/education boilerplate) is OUT of
 *                     the coverage denominator by design — a transcript-anchored note must not
 *                     be penalized for omitting it. (null when the gold section is empty)
 *   unvoicedGoldShare 0-1 — the judge's estimate of the fraction of the gold section's content
 *                     that is NOT transcript-derivable, so a low coverage number is
 *                     interpretable per case. (null when gold empty or section not judged)
 *   fabrication       0-2 — UNCHANGED from v1: 2 = no unsupported clinical claims; a claim is
 *                     supported when it appears in the GOLD note OR the TRANSCRIPT; null when
 *                     the prediction is empty. Style/format/length are never judged.
 * plus a one-line rationale each (file-only — stdout carries scores, never clinical text).
 * freetext-summary.json refuses to aggregate mixed criteriaVersions — re-judge with --force.
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

// Bumped whenever the judging criteria change, so old and new judgments can never be silently
// mixed in one aggregate. v1 (implicit — files without the field): coverage vs ALL gold content.
// v2: coverage vs transcript-derivable gold only + unvoicedGoldShare.
const CRITERIA_VERSION = 2;

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
          unvoicedGoldShare: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description:
              'fraction (0.0-1.0) of the GOLD section content that is NOT stated or clearly implied in the TRANSCRIPT',
          },
          coverage: {
            type: 'integer',
            minimum: 0,
            maximum: 2,
            description:
              'over ONLY the transcript-derivable gold facts: 0 = most missing from predicted, 1 = partial, 2 = all or nearly all present',
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
        required: ['section', 'unvoicedGoldShare', 'coverage', 'fabrication', 'rationale'],
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
    `gold note omits it. The predicted note is transcript-anchored BY DESIGN: it must only ` +
    `document what was dictated, while GOLD often carries content with no transcript basis ` +
    `(prior-chart knowledge, standing discharge/education/caregiver-understanding boilerplate). ` +
    `The three judgments below keep those concerns explicitly distinct.\n\n` +
    `For EACH section below return three scores and a one-line rationale:\n` +
    `- unvoicedGoldShare (0.0-1.0): FIRST, estimate the fraction of the GOLD section's clinical ` +
    `content that is NOT stated or clearly implied anywhere in the TRANSCRIPT. 0 = every gold ` +
    `fact is transcript-derivable; 1 = none of it is. When GOLD is (empty), return 0 — ignored ` +
    `downstream.\n` +
    `- coverage (0-2): THEN, over ONLY the transcript-derivable part of GOLD (the complement of ` +
    `unvoicedGoldShare): how many of those gold facts appear in PREDICTED? 0 = most missing, ` +
    `1 = partial, 2 = all or nearly all. NEVER penalize PREDICTED for omitting gold content ` +
    `that is absent from the transcript — that content is out of scope by design. When GOLD is ` +
    `(empty), return 2 — ignored downstream.\n` +
    `- fabrication (0-2): unsupported clinical claims in PREDICTED. A claim is supported when it ` +
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
  // v2: judge-estimated fraction (0-1) of gold content NOT transcript-derivable — the context
  // needed to interpret coverage per case. null when gold empty or the section wasn't judged.
  unvoicedGoldShare: number | null;
  fabrication: number | null;
  rationale: string;
}

const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 2;
const isShare = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

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
        unvoicedGoldShare: null, // not judged — no LLM call for this section
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
    unvoicedGoldShare?: number;
    coverage?: number;
    fabrication?: number;
    rationale?: string;
  }[];
  for (const s of toJudge) {
    const j = raw.find((r) => r.section === s.name);
    if (!j || !isScore(j.coverage) || !isScore(j.fabrication) || !isShare(j.unvoicedGoldShare)) {
      throw new Error(`judge returned no valid scores for section ${s.name}`);
    }
    out[s.name] = {
      goldPresent: !!s.goldText,
      predictedPresent: true,
      // empty gold → coverage/share meaningless (judge told to emit 2 / 0 there)
      coverage: s.goldText ? j.coverage : null,
      unvoicedGoldShare: s.goldText ? j.unvoicedGoldShare : null,
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
  criteriaVersion?: number; // absent = v1 (pre-transcript-scoped coverage)
  sections: Record<SectionName, SectionJudgment>;
}

function rebuildSummary(resultsDir: string): void {
  const files = readdirSync(resultsDir)
    .filter((f) => /^case\d+\.freetext\.json$/.test(f))
    .sort();
  const judged = files.map((f) => JSON.parse(readFileSync(join(resultsDir, f), 'utf8')) as FreetextFile);
  // Coverage means different things across criteria versions — refuse a mixed aggregate.
  const versions = [...new Set(judged.map((c) => c.criteriaVersion ?? 1))].sort();
  if (versions.length > 1) {
    throw new Error(
      `freetext files in ${resultsDir} mix judge criteria versions (${versions.join(', ')}) — their coverage ` +
        `numbers are not comparable. Re-judge the whole dir on the current criteria with --force:\n` +
        `  npx env-cmd -f packages/zambdas/.env/local.json npx tsx scripts/easy-chart-eval/judge-freetext.ts ${resultsDir} --force`
    );
  }
  const summary = {
    judgedCases: judged.length,
    criteriaVersion: versions[0] ?? CRITERIA_VERSION,
    sections: {} as Record<
      SectionName,
      {
        goldPresent: number;
        predictedPresent: number;
        coverageJudged: number;
        coverageMean: number | null;
        unvoicedShareJudged: number;
        unvoicedShareMean: number | null;
        fabricationJudged: number;
        fabricationMean: number | null;
        fabricationFlagged: number; // sections judged < 2 (any unsupported claim)
      }
    >,
  };
  for (const name of SECTIONS) {
    const rows = judged.map((c) => c.sections[name]).filter(Boolean);
    const cov = rows.map((r) => r.coverage).filter((v): v is number => v != null);
    const share = rows.map((r) => r.unvoicedGoldShare).filter((v): v is number => v != null);
    const fab = rows.map((r) => r.fabrication).filter((v): v is number => v != null);
    summary.sections[name] = {
      goldPresent: rows.filter((r) => r.goldPresent).length,
      predictedPresent: rows.filter((r) => r.predictedPresent).length,
      coverageJudged: cov.length,
      coverageMean: cov.length > 0 ? cov.reduce((a, b) => a + b, 0) / cov.length : null,
      unvoicedShareJudged: share.length,
      unvoicedShareMean: share.length > 0 ? share.reduce((a, b) => a + b, 0) / share.length : null,
      fabricationJudged: fab.length,
      fabricationMean: fab.length > 0 ? fab.reduce((a, b) => a + b, 0) / fab.length : null,
      fabricationFlagged: fab.filter((v) => v < 2).length,
    };
  }
  writeFileSync(join(resultsDir, 'freetext-summary.json'), JSON.stringify(summary, null, 2));

  const fmtMean = (v: number | null): string => (v === null ? '   —' : v.toFixed(2));
  console.log(
    `\nfreetext-summary.json rebuilt from ${judged.length} freetext files in ${resultsDir} (criteria v${summary.criteriaVersion})`
  );
  console.log('section                    gold  pred  covN  covMean  unvN  unvMean  fabN  fabMean  fabFlagged');
  for (const name of SECTIONS) {
    const s = summary.sections[name];
    console.log(
      `${name.padEnd(26)} ${String(s.goldPresent).padStart(4)} ${String(s.predictedPresent).padStart(5)} ${String(
        s.coverageJudged
      ).padStart(5)} ${fmtMean(s.coverageMean).padStart(8)} ${String(s.unvoicedShareJudged).padStart(5)} ${fmtMean(
        s.unvoicedShareMean
      ).padStart(8)} ${String(s.fabricationJudged).padStart(5)} ${fmtMean(s.fabricationMean).padStart(8)} ${String(
        s.fabricationFlagged
      ).padStart(11)}`
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
const fmtShare = (v: number | null): string => (v === null ? '—' : v.toFixed(2));
const sectionPart = (label: string, s: SectionJudgment): string =>
  `${label} cov ${fmtScore(s.coverage)} unv ${fmtShare(s.unvoicedGoldShare)} fab ${fmtScore(s.fabrication)}`;
const caseLine = (caseId: string, sections: Record<SectionName, SectionJudgment>): string =>
  `${caseId}: ${sectionPart('HPI', sections.historyOfPresentIllness)} | ${sectionPart(
    'MDM',
    sections.medicalDecisionMaking
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
          criteriaVersion: CRITERIA_VERSION,
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
