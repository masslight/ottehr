/**
 * Autochart acceptance test: transcript → easy-chart-narrative lines, on the recordings in autochart-cases/
 * (autochart-tests.md explains how the fact lists were made and how the checks score). The source of the "Autochart Narrative" card on the AI accuracy dashboard when
 * the CI repo's nightly workflow runs it with --json-out.
 *
 * The narrative is the read-back the provider corrects before the plan runs, so it is judged as a
 * read-back: every fact must be in some line — the voiced chart items whose wording the recording carries, plus
 * the case file's `narrativeFacts` — the lines must be backed by transcript snippets the server could verify, and no
 * line may distort what was said. The last one is the only judgement a regex cannot make, so a Gemini
 * judge — the same one the other AI suites use — reads the transcript against the lines and lists the
 * lines that contradict it. Omissions the judge notices are printed, not scored: coverage is the fact
 * list's job.
 *
 * Requires the local zambda server (default port 3000, or --url http://localhost:3010):
 *   cd packages/zambdas && npx tsx src/local-server/index.ts -- secrets=.env/zambda-secrets-local.json
 *
 * Usage:
 *   npx tsx scripts/tests/test-autochart-narrative.ts [--env local] [--url http://localhost:3010]
 *     [--json-out results.json] [--cases id1,id2] [--concurrency 2] [--skip-judge] [--judge-model <name>] [--verbose]
 */

import * as fs from 'fs';
import type { ChartNarrativeResponse, NarrativeLine } from 'utils/lib/easy-chart/api';
import { AutochartCase } from './autochart-case-file';
import { Check, mapWithConcurrency, parseSuiteArgs, printChecks, tally } from './autochart-shared';
import { callGemini, callZambda, getToken } from './shared';

const args = parseSuiteArgs(process.argv);
const skipJudge = process.argv.includes('--skip-judge');
/** The judge model: the one the product itself runs on, unless `--judge-model` names another. */
const judgeModelFlag = process.argv.indexOf('--judge-model');
const judgeModel = judgeModelFlag !== -1 ? process.argv[judgeModelFlag + 1] : 'gemini-3.1-flash-lite';

/** Lines the server could not back with a verbatim transcript snippet; a tenth of the read-back at most. */
const MAX_UNBACKED_SHARE = 0.1;

interface JudgeVerdict {
  contradictions: { line: number; reason: string }[];
  omissions: string[];
}

interface CaseResult {
  id: string;
  label: string;
  lines: NarrativeLine[];
  checks: Check[];
  judge?: JudgeVerdict;
  error?: string;
}

/**
 * The recordings' "Provider:" / "Patient:" labels are sometimes swapped, and a judge that trusts them flags
 * a correct line ("the transcript says the provider was bitten"). The judge gets the words without the labels
 * and works out who is speaking from what is said — which is what the narrative endpoint has to do too.
 */
const withoutSpeakerLabels = (transcript: string): string =>
  transcript.replace(/\b(?:Provider|Patient|Doctor|Nurse|Parent|Mother|Father|Speaker \d+):\s*/g, '');

async function judgeNarrative(transcript: string, lines: NarrativeLine[]): Promise<JudgeVerdict> {
  const numbered = lines.map((line, i) => `${i + 1}. ${line.text}`).join('\n');
  const prompt = `You are checking a clinical read-back for fidelity. Below is the transcript of a visit and a numbered list of narrative lines that were written from it.

List every line whose meaning CONTRADICTS or DISTORTS the transcript: a different drug, dose, frequency, duration, side, timing, count or polarity than the transcript states; something presented as a fact of this visit that the transcript never says; a symptom the patient denied written as present, or the reverse. Do NOT flag a line for paraphrasing, for reordering, for leaving something out, or for using clinical wording ("otalgia" for "ear pain"). A patient's report and a test or exam result that differ from it are both facts of the visit, not a contradiction: "denies seeing blood in the urine" beside "urinalysis shows blood" is correct. The transcript has no speaker labels: work out who is speaking from what is said (the one describing symptoms is the patient; the one examining, explaining and prescribing is the clinician), and never flag a line for how it attributes a statement.

Then list, briefly, the clinically relevant facts from the transcript that no line carries (omissions).

Return JSON with "contradictions" (an array of {"line": <number>, "reason": <string>}) and "omissions" (an array of strings). Use empty arrays when there is nothing to report.

TRANSCRIPT:
${withoutSpeakerLabels(transcript)}

NARRATIVE LINES:
${numbered}`;

  const schema = {
    type: 'object',
    properties: {
      contradictions: {
        type: 'array',
        items: {
          type: 'object',
          properties: { line: { type: 'integer' }, reason: { type: 'string' } },
          required: ['line', 'reason'],
        },
      },
      omissions: { type: 'array', items: { type: 'string' } },
    },
    required: ['contradictions', 'omissions'],
  };
  const text = await callGemini(
    prompt,
    args.envConfig.GOOGLE_CLOUD_PROJECT_ID,
    args.envConfig.GOOGLE_CLOUD_API_KEY,
    schema,
    judgeModel
  );
  return JSON.parse(text) as JudgeVerdict;
}

function checkNarrative(c: AutochartCase, lines: NarrativeLine[], verdict: JudgeVerdict | undefined): Check[] {
  const texts = lines.map((line) => line.text);
  const checks: Check[] = [];
  for (const fact of c.facts) {
    checks.push({
      label: `mentions ${fact.pattern}${fact.tag === 'voiced' ? ` (${fact.label})` : ''}`,
      passed: texts.some((t) => fact.pattern.test(t)),
      tag: fact.tag,
    });
  }
  const unbacked = lines.filter((line) => line.sources.length === 0);
  checks.push({
    label: `at most ${Math.round(MAX_UNBACKED_SHARE * 100)}% of lines unbacked by the transcript`,
    passed: lines.length > 0 && unbacked.length <= Math.max(1, Math.floor(lines.length * MAX_UNBACKED_SHARE)),
    tag: 'invariant',
    detail: `${unbacked.length} of ${lines.length}: ${unbacked.map((line) => line.text).join(' | ')}`,
  });
  if (verdict) {
    checks.push({
      label: 'no line contradicts the transcript (judge)',
      passed: verdict.contradictions.length === 0,
      tag: 'invariant',
      detail: verdict.contradictions.map((x) => `line ${x.line}: ${x.reason}`).join(' | '),
    });
  }
  return checks;
}

async function runCase(token: string, c: AutochartCase): Promise<CaseResult> {
  const result: CaseResult = { id: c.id, label: c.label, lines: [], checks: [] };
  try {
    const narrative = await callZambda<ChartNarrativeResponse>('easy-chart-narrative', token, {
      transcript: c.transcript,
    });
    result.lines = narrative.lines;
    if (!skipJudge) result.judge = await judgeNarrative(c.transcript, narrative.lines);
    result.checks = checkNarrative(c, narrative.lines, result.judge);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

function printCase(result: CaseResult): void {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${result.id}: ${result.label}`);
  console.log('─'.repeat(72));
  if (result.error) {
    console.log(`  ERROR: ${result.error}`);
    return;
  }
  const t = tally(result.checks);
  console.log(`  ${t.passed}/${t.total} checks  (${result.lines.length} lines)`);
  printChecks(result.checks);
  if (result.judge?.omissions.length) console.log(`    judge noticed omitted: ${result.judge.omissions.join('; ')}`);
  if (args.verbose) {
    for (const line of result.lines) {
      const mark = line.sources.length ? ' ' : '?';
      console.log(`    ${mark} ${line.text}`);
    }
  }
}

async function main(): Promise<void> {
  const token = await getToken(args.envConfig);
  console.log(
    `Autochart narrative: ${args.cases.length} case(s), concurrency ${args.concurrency}${
      skipJudge ? ', judge off' : ''
    }`
  );

  // Printed as each case completes, so a long run over the corpus leaves its trace even if it is cut short.
  const results = await mapWithConcurrency(args.cases, args.concurrency, async (c) => {
    const result = await runCase(token, c);
    printCase(result);
    return result;
  });

  const all = tally(results.flatMap((r) => r.checks));
  const errors = results.filter((r) => r.error).length;
  console.log(`\n${'═'.repeat(72)}`);
  console.log(
    `  ${all.passed}/${all.total} checks passed across ${results.length} cases${errors ? `, ${errors} errored` : ''}`
  );
  console.log('═'.repeat(72));

  if (args.jsonOutPath) {
    fs.writeFileSync(
      args.jsonOutPath,
      JSON.stringify(
        {
          suite: 'autochart-narrative',
          timestamp: new Date().toISOString(),
          passed: all.passed,
          total: all.total,
          cases: results.map((r) => ({
            id: r.id,
            error: r.error,
            ...tally(r.checks),
            lines: r.lines.length,
            failed: r.checks.filter((c) => !c.passed).map((c) => c.label),
            omissions: r.judge?.omissions ?? [],
          })),
        },
        null,
        2
      )
    );
  }

  if (all.passed < all.total || errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
