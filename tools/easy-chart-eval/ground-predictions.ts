/**
 * ground-predictions.ts — of what we charted and the gold does not contain, how much did the
 * provider actually SAY?
 *
 * `overcharted` (predicted, and nowhere in the gold) is read as the model's false positives, and for
 * some sections that reading is wrong. Measured earlier on ROS: of 208 cases where we charted a fever,
 * cough, vomiting, diarrhea or rhinorrhea row absent from the gold, 206 have that symptom in the
 * dictation. The gold is the chart the provider SIGNED, not everything that was said, so an item they
 * simply never ticked is scored as an error.
 *
 * The voicing tags cannot help: they only ever forgive a prediction that lands on gold the provider
 * DID chart. Anything missing from the chart entirely is charged to precision whether or not it was
 * spoken. This pass closes that asymmetry by asking the SAME judge the SAME question about the other
 * side — the items we charted that the gold lacks:
 *
 *   grounded    the dictation supports it. The chart is the incomplete side, not the model.
 *   ungrounded  neither in the gold nor in the dictation. A real false positive.
 *
 * Deliberately the same model and the same criterion wording as tag-voiced.ts, because the whole point
 * is that the two sides be comparable. A hand-rolled keyword heuristic would answer a different
 * question and could not be set against the gold-side numbers.
 *
 * Results are written per case as `<runDir>/<caseId>.grounding.json` and never touch the case files or
 * the score files: scoring stays deterministic and offline, and a run can be re-scored without this.
 *
 * Usage (needs ANTHROPIC_API_KEY):
 *   npx env-cmd -f packages/zambdas/.env/zambda-secrets-local.json \
 *     npx tsx tools/easy-chart-eval/ground-predictions.ts <runDir> [--cases case001,...] [--limit N]
 *   npx tsx tools/easy-chart-eval/ground-predictions.ts <runDir> --report   # aggregate what exists
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { PLANNABLE_VITAL_FIELDS, PlannableVitalField } from 'utils/lib/easy-chart/actions';
import {
  historyMatches,
  isUnvoiced,
  nameMatch,
  normCode,
  rosBaseAndPolarity,
  uniqueVitals,
  vitalMatchesGold,
} from './score-harvested';

const JUDGE_MODEL = 'claude-sonnet-5';
const CONCURRENCY = 3;
const TOOL_NAME = 'return_judgments';

type Section =
  | 'diagnoses'
  | 'cpt'
  | 'ros'
  | 'exam'
  | 'medications'
  | 'vitals'
  | 'allergies'
  | 'conditions'
  | 'surgicalHistory'
  | 'hospitalizations';
/** Every section this pass knows. A grounding file records which of these it has judged (see `sections`). */
const ALL_SECTIONS: Section[] = [
  'diagnoses',
  'cpt',
  'ros',
  'exam',
  'medications',
  'vitals',
  'allergies',
  'conditions',
  'surgicalHistory',
  'hospitalizations',
];
/** What a grounding file written before the `sections` field existed had judged. */
const LEGACY_SECTIONS: Section[] = ['diagnoses', 'cpt', 'ros', 'exam', 'medications'];
interface Item {
  section: Section;
  text: string;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          grounded: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['index', 'grounded'],
      },
    },
  },
  required: ['items'],
};

function buildJudgePrompt(transcript: string, items: Item[]): string {
  const list = items.map((it, i) => `${i + 1}. [${it.section}] ${it.text}`).join('\n');
  return (
    `You are auditing an ambient-scribe evaluation. Below is the raw dictation transcript of a clinic ` +
    `visit, followed by a numbered list of items an automated scribe charted for that visit. None of ` +
    `these items appear in the note the provider ultimately signed.\n\n` +
    `For EACH item, judge whether it is GROUNDED: stated or clearly implied in the dictation. The ` +
    `question is ONLY whether the dictation supports it — not whether the provider chose to chart it, ` +
    `and not whether it is clinically wise. Clearly implied counts (e.g. "lungs sound clear" implies a ` +
    `normal lung exam; "we'll start an antibiotic, amoxicillin" implies the amoxicillin). An item that ` +
    `could only come from prior-chart knowledge, from exam-template defaults the provider never ` +
    `dictated, or from a guess about what is typical for the complaint is NOT grounded.\n\n` +
    `For [ros] items, the POLARITY is part of the claim: "Denies fever" is grounded only if the ` +
    `dictation says fever was denied or absent, and "Reports fever" only if it says fever was present. ` +
    `A transcript that merely mentions the word does not ground the opposite polarity.\n\n` +
    `For [vitals] items, the VALUE is part of the claim: a reading is grounded only if the dictation states ` +
    `that measurement (the same number, in any unit). For [allergies], [conditions], [surgicalHistory] and ` +
    `[hospitalizations], the item is grounded when the dictation states that history ("known history of ` +
    `asthma", "allergic to penicillin", "had her appendix out") — not when it is merely plausible.\n\n` +
    `When grounded is true, include a short (at most 10 words) verbatim quote or close paraphrase from ` +
    `the transcript as evidence.\n\n` +
    `Return a judgment for EVERY item, using the item's number as its index.\n\n` +
    `TRANSCRIPT:\n"""\n${transcript}\n"""\n\nITEMS:\n${list}`
  );
}

async function claudeStructured(
  prompt: string,
  apiKey: string
): Promise<{ index: number; grounded: boolean; evidence?: string }[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 8192,
      tools: [{ name: TOOL_NAME, description: 'Return the structured judgments.', input_schema: RESPONSE_SCHEMA }],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  });
  if (!response.ok) throw new Error(`anthropic ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json()) as { content?: { type: string; input?: { items?: unknown } }[] };
  const use = body.content?.find((c) => c.type === 'tool_use');
  const items = use?.input?.items;
  if (!Array.isArray(items)) throw new Error('judge returned no items array');
  return items as { index: number; grounded: boolean; evidence?: string }[];
}

/** Predictions the gold does not contain, using the scorer's own match keys. */
function overchartedItems(gold: Record<string, any>, state: Record<string, any>): Item[] {
  const live = (arr: unknown): Record<string, any>[] =>
    (Array.isArray(arr) ? arr : []).filter((x: any) => x && !x.removed);
  const out: Item[] = [];

  const dxScorable = (gold.assessment?.diagnoses ?? []).filter((d: any) => !d.fromLabOrder);
  const dxKeys = new Set<string>([
    ...dxScorable.map((d: any) => d.codeNormalized),
    ...(gold.assessment?.diagnoses ?? []).filter((d: any) => d.fromLabOrder).map((d: any) => d.codeNormalized),
  ]);
  for (const p of live(state.diagnoses)) {
    const c = normCode(p.code);
    if (c && !dxKeys.has(c)) out.push({ section: 'diagnoses', text: `${c} — ${p.display ?? ''}` });
  }

  const cptKeys = new Set((gold.billing?.cptCodes ?? []).map((c: any) => c.codeNormalized));
  const seenCpt = new Set<string>();
  for (const p of live(state.cptCodes)) {
    const c = normCode(p.code);
    if (c && !cptKeys.has(c) && !seenCpt.has(c)) {
      seenCpt.add(c);
      out.push({ section: 'cpt', text: `${c} — ${p.display ?? ''}` });
    }
  }

  const rosKeys = new Set<string>();
  for (const o of gold.reviewOfSystems?.observations ?? []) {
    if (o.present === true) rosKeys.add(rosBaseAndPolarity(o.field).base);
  }
  const seenRos = new Set<string>();
  for (const p of live(state.rosObservations)) {
    if (!rosKeys.has(p.baseKey) && !seenRos.has(p.baseKey)) {
      seenRos.add(p.baseKey);
      out.push({ section: 'ros', text: p.label ?? p.baseKey });
    }
  }

  const examKeys = new Set<string>((gold.exam ?? []).filter((e: any) => e.present === true).map((e: any) => e.field));
  for (const p of live(state.examObservations)) {
    if (!examKeys.has(p.field)) out.push({ section: 'exam', text: p.label ?? p.field });
  }

  // Medications are one shared pool matched fuzzily, exactly as the scorer does it.
  const goldMeds: (string | undefined)[] = [
    ...(gold.medications?.prescribed ?? []).map((m: any) => m.name),
    ...(gold.medications?.inHouseAdministered ?? []).map((m: any) => m.name),
    ...(gold.medications?.immunizations ?? []).map((m: any) => m.name),
    ...(gold.medications?.currentReconciled ?? []).map((m: any) => m.name),
  ];
  for (const p of live(state.medications)) {
    if (!goldMeds.some((g) => nameMatch(p.display, g))) out.push({ section: 'medications', text: p.display ?? '' });
  }

  // Context sections — the same match rules the scorer uses, so "overcharted" here is exactly the
  // scorer's predicted − matched. Vitals carry no `removed`/`source`; the others are plain SimItems.
  const plannable = new Set<string>(PLANNABLE_VITAL_FIELDS);
  const goldVitals: Record<string, unknown>[] = (gold.vitals ?? []).filter((v: any) => plannable.has(String(v.field)));
  const vitals = uniqueVitals(
    (Array.isArray(state.vitals) ? state.vitals : []) as { field: string; display: string }[]
  );
  for (const v of vitals) {
    if (!plannable.has(v.field)) continue;
    if (!goldVitals.some((g) => vitalMatchesGold(v.field as PlannableVitalField, v.display, g))) {
      out.push({ section: 'vitals', text: `${v.field.replace(/^vital-/, '')}: ${v.display}` });
    }
  }
  const history: [Section, unknown, { display?: string; codeNormalized?: string }[]][] = [
    ['allergies', state.allergies, (gold.allergies ?? []).map((a: any) => ({ display: a.name }))],
    ['conditions', state.conditions, gold.medicalHistory ?? []],
    ['surgicalHistory', state.surgicalHistory, gold.surgicalHistory ?? []],
    ['hospitalizations', state.hospitalizations, gold.hospitalizations ?? []],
  ];
  for (const [section, predicted, goldItems] of history) {
    for (const p of live(predicted)) {
      if (!goldItems.some((g) => historyMatches(p, g))) {
        out.push({ section, text: p.code ? `${p.display ?? ''} (${p.code})` : p.display ?? '' });
      }
    }
  }
  void isUnvoiced;
  return out;
}

function casesDirFor(runDir: string): string {
  const c = join(dirname(dirname(runDir)), 'harvested-cases');
  if (!existsSync(c)) throw new Error(`no harvested-cases beside ${runDir}`);
  return c;
}

function report(runDir: string): void {
  const files = readdirSync(runDir).filter((f) => f.endsWith('.grounding.json'));
  if (files.length === 0) return console.log('no grounding files yet — run without --report first');
  const agg: Record<string, { grounded: number; ungrounded: number }> = {};
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(runDir, f), 'utf8')) as { items: { section: string; grounded: boolean }[] };
    for (const it of j.items) {
      agg[it.section] ??= { grounded: 0, ungrounded: 0 };
      agg[it.section][it.grounded ? 'grounded' : 'ungrounded']++;
    }
  }
  console.log(`grounding over ${files.length} cases — of what we charted that the gold lacks:\n`);
  console.log(
    `${'section'.padEnd(14)}${'overcharted'.padStart(12)}${'grounded'.padStart(11)}${'ungrounded'.padStart(
      12
    )}${'% grounded'.padStart(12)}`
  );
  let tg = 0;
  let tu = 0;
  for (const [s, v] of Object.entries(agg)) {
    const tot = v.grounded + v.ungrounded;
    tg += v.grounded;
    tu += v.ungrounded;
    console.log(
      `${s.padEnd(14)}${String(tot).padStart(12)}${String(v.grounded).padStart(11)}${String(v.ungrounded).padStart(
        12
      )}${`${((100 * v.grounded) / tot).toFixed(1)}%`.padStart(12)}`
    );
  }
  console.log(
    `${'TOTAL'.padEnd(14)}${String(tg + tu).padStart(12)}${String(tg).padStart(11)}${String(tu).padStart(12)}${`${(
      (100 * tg) /
      (tg + tu)
    ).toFixed(1)}%`.padStart(12)}`
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const runDir = args.find((a) => !a.startsWith('--'));
  if (!runDir || !existsSync(runDir)) {
    console.log('usage: ground-predictions.ts <runDir> [--cases case001,...] [--limit N] [--report]');
    process.exit(1);
  }
  if (args.includes('--report')) return report(runDir);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
  const casesDir = casesDirFor(runDir);
  const only = args.includes('--cases') ? new Set(args[args.indexOf('--cases') + 1].split(',')) : undefined;
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : undefined;

  let ids = readdirSync(runDir)
    .filter((f) => f.endsWith('.result.json'))
    .map((f) => f.replace('.result.json', ''))
    .filter((id) => (only ? only.has(id) : true))
    .sort();
  if (limit !== undefined) ids = ids.slice(0, limit);
  console.log(`${ids.length} cases to judge (model ${JUDGE_MODEL}, concurrency ${CONCURRENCY})`);

  let next = 0;
  let done = 0;
  let failed = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= ids.length) return;
      const id = ids[i];
      try {
        const c = JSON.parse(readFileSync(join(casesDir, `${id}.json`), 'utf8')) as {
          transcript?: string;
          gold: Record<string, any>;
        };
        const r = JSON.parse(readFileSync(join(runDir, `${id}.result.json`), 'utf8')) as Record<string, any>;
        const state = r.state ?? r.finalState;
        // INCREMENTAL, per section. A case already judged keeps its verdicts; only the sections its file
        // has never covered are judged now and appended — so adding a section to this pass costs one
        // small call per case, not a re-judgement of everything, and a killed run resumes where it stopped.
        const groundingPath = join(runDir, `${id}.grounding.json`);
        const existing = existsSync(groundingPath)
          ? (JSON.parse(readFileSync(groundingPath, 'utf8')) as { items: Item[]; sections?: Section[] })
          : undefined;
        const judgedSections = new Set<Section>(existing ? existing.sections ?? LEGACY_SECTIONS : []);
        const items = overchartedItems(c.gold ?? {}, state ?? {}).filter((it) => !judgedSections.has(it.section));
        const kept = existing?.items ?? [];
        const write = (fresh: object[]): void =>
          writeFileSync(
            groundingPath,
            JSON.stringify(
              { caseId: id, model: JUDGE_MODEL, sections: ALL_SECTIONS, items: [...kept, ...fresh] },
              null,
              2
            )
          );
        if (items.length === 0) {
          if (!existing || !existing.sections) write([]);
          done++;
          continue;
        }
        const judged = await claudeStructured(buildJudgePrompt(c.transcript ?? '', items), apiKey);
        const byIndex = new Map(judged.map((j) => [j.index, j]));
        const out = items.map((it, i2) => ({
          ...it,
          grounded: byIndex.get(i2 + 1)?.grounded === true,
          evidence: byIndex.get(i2 + 1)?.evidence,
          judged: byIndex.has(i2 + 1),
        }));
        write(out);
        const g = out.filter((x) => x.grounded).length;
        console.log(`${id}: ${g}/${out.length} grounded (${[...new Set(items.map((it) => it.section))].join(',')})`);
        done++;
      } catch (error) {
        failed++;
        console.log(`${id}: FAILED — ${String(error).slice(0, 120)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\ndone: ${done} ok, ${failed} failed`);
  report(runDir);
}

void main();
