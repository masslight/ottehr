/**
 * tag-voiced.ts — offline LLM-judge pass that stamps transcript-derivability onto harvested
 * gold items, so score-harvested.ts recall denominators can be scoped to what a scribe could
 * actually have heard.
 *
 * For each caseNNN.json it collects the scorable gold items (diagnoses, ROS observations,
 * exam findings, billing CPT codes, prescribed meds — skipping items already out of planner
 * scope: `context: true` and `fromLabOrder`), makes ONE structured LLM call with the transcript
 * plus the numbered item list, and writes the judgments back onto each gold item in place:
 *   voiced: boolean            — "stated or clearly implied in the dictation"
 *   voicedEvidence?: string    — <=10-word transcript quote/paraphrase, only when voiced
 * These are ADDITIVE fields — schemaVersion is untouched and all other fields are preserved
 * (untagged files keep scoring exactly as before). Idempotent: a case whose collectible items
 * all carry a boolean `voiced` is skipped unless --force.
 *
 * Usage (needs ANTHROPIC_API_KEY except in --dry-run):
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/tag-voiced.ts [casesDir] [flags]
 *
 * Flags:
 *   --dry-run            enumerate cases and per-section item counts that WOULD be tagged,
 *                        then exit before any API call (no API key needed).
 *   --force              re-tag cases even when already fully tagged.
 *   --cases=case002,...  limit to specific caseIds (e.g. to retry judge failures).
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { GoldData } from './harvest-shared';
import { rosBaseAndPolarity } from './score-harvested';

// ---------------------------------------------------------------------------
// Item collection
// ---------------------------------------------------------------------------
type Section = 'diagnoses' | 'ros' | 'exam' | 'cpt' | 'medsPrescribed';
const SECTIONS: Section[] = ['diagnoses', 'ros', 'exam', 'cpt', 'medsPrescribed'];

interface TagItem {
  section: Section;
  text: string;
  // The live gold-item object from the parsed case file — judgments are written onto it.
  ref: Record<string, unknown>;
}

const isContext = (item: unknown): boolean => (item as { context?: boolean }).context === true;

function collectItems(gold: GoldData): TagItem[] {
  const items: TagItem[] = [];
  for (const d of gold.assessment.diagnoses) {
    if (d.fromLabOrder || isContext(d)) continue; // already out of planner scope for the scorer
    items.push({
      section: 'diagnoses',
      text: `${d.display} (${d.code})`,
      ref: d as unknown as Record<string, unknown>,
    });
  }
  for (const o of gold.reviewOfSystems.observations) {
    if (o.present !== true || isContext(o)) continue; // scorer only scores present:true
    const { polarity } = rosBaseAndPolarity(o.field);
    const verb = polarity === 'denies' ? 'Denies' : polarity === 'reports' ? 'Reports' : '';
    items.push({
      section: 'ros',
      text: `${verb ? `${verb} ` : ''}${o.label ?? o.field}`.trim(),
      ref: o as unknown as Record<string, unknown>,
    });
  }
  for (const o of gold.exam) {
    if (o.present !== true || isContext(o)) continue;
    const checked = (o.components ?? []).filter((c) => c.value === true).map((c) => c.label);
    items.push({
      section: 'exam',
      text: `${o.label ?? o.field}${checked.length ? ` (${checked.join(', ')})` : ''}${
        o.abnormal ? ' [abnormal]' : ''
      }`,
      ref: o as unknown as Record<string, unknown>,
    });
  }
  for (const c of gold.billing.cptCodes) {
    if (isContext(c)) continue;
    items.push({ section: 'cpt', text: `${c.display} (${c.code})`, ref: c as unknown as Record<string, unknown> });
  }
  for (const m of gold.medications.prescribed) {
    if (isContext(m)) continue;
    items.push({
      section: 'medsPrescribed',
      text: `${m.name ?? 'Unknown'}${m.sig ? ` — ${m.sig}` : ''}`,
      ref: m as unknown as Record<string, unknown>,
    });
  }
  return items;
}

const isTagged = (item: TagItem): boolean => typeof item.ref.voiced === 'boolean';

// ---------------------------------------------------------------------------
// LLM judge — direct Anthropic API, forced tool_use with a JSON schema (same call shape as
// invokeClaudeStructured in packages/zambdas/src/shared/ai.ts). claudeStructured and
// coerceArrayField are exported for reuse by judge-freetext.ts.
// ---------------------------------------------------------------------------
export const JUDGE_MODEL = 'claude-sonnet-5';
const TOOL_NAME = 'emit_judgments';

// One forced-tool-use structured call; returns the tool_use input object.
export async function claudeStructured(
  prompt: string,
  responseSchema: object,
  toolName: string,
  apiKey: string,
  maxTokens = 16384
): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: maxTokens,
      // Mirror ai.ts invokeClaudeStructured: claude-sonnet-5 rejects non-default sampling
      // params, so omit temperature; it also runs adaptive thinking by default, which would eat
      // the output budget ahead of the forced tool_use — disable it for this extraction path.
      thinking: { type: 'disabled' },
      tools: [{ name: toolName, description: 'Return the structured judgments.', input_schema: responseSchema }],
      tool_choice: { type: 'tool', name: toolName },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await response.json();
  if (json.stop_reason === 'max_tokens') throw new Error(`Anthropic output truncated (max_tokens, ${JUDGE_MODEL})`);
  const toolUse = (json.content ?? []).find((b: { type?: string }) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Anthropic returned no tool_use block');
  return (toolUse.input ?? {}) as Record<string, unknown>;
}

// claude-sonnet-5 frequently returns a forced tool_use array field as a STRING of JSON instead
// of a typed array — and double-wrapped: the string holds the full {"<field>":[...]} object.
// Coerce both shapes (stripping a stray markdown fence first); returns [] when not coercible so
// the caller's completeness check fails and the case stays retryable.
export function coerceArrayField(input: Record<string, unknown>, field: string): unknown[] {
  let value: unknown = input[field];
  if (typeof value === 'string') {
    const stripped = value
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    try {
      const parsed: unknown = JSON.parse(stripped);
      value = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>)?.[field];
    } catch {
      value = undefined;
    }
  }
  return Array.isArray(value) ? value : [];
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: '1-based index from the item list' },
          voiced: { type: 'boolean', description: 'true when stated or clearly implied in the dictation' },
          evidence: {
            type: 'string',
            description: 'Only when voiced: <=10-word transcript quote or close paraphrase',
          },
        },
        required: ['index', 'voiced'],
      },
    },
  },
  required: ['items'],
};

function buildPrompt(transcript: string, items: TagItem[]): string {
  const list = items.map((it, i) => `${i + 1}. [${it.section}] ${it.text}`).join('\n');
  return (
    `You are auditing the gold standard of an ambient-scribe evaluation. Below is the raw ` +
    `dictation transcript of a clinic visit, followed by a numbered list of items the provider ` +
    `ultimately charted for that visit.\n\n` +
    `For EACH item, judge whether it is VOICED: stated or clearly implied in the dictation. ` +
    `Clearly implied counts (e.g. "lungs sound clear" implies a normal lung exam; "we'll start ` +
    `an antibiotic, amoxicillin" implies the amoxicillin prescription). Items that could only ` +
    `come from prior-chart knowledge, exam-template defaults the provider never dictated, or ` +
    `billing conventions are NOT voiced. When voiced is true, include a short (at most 10 words) ` +
    `verbatim quote or close paraphrase from the transcript as evidence.\n\n` +
    `Return a judgment for EVERY item, using the item's number as its index.\n\n` +
    `TRANSCRIPT:\n"""\n${transcript}\n"""\n\nITEMS:\n${list}`
  );
}

interface Judgment {
  voiced: boolean;
  evidence?: string;
}

async function judgeCase(transcript: string, items: TagItem[], apiKey: string): Promise<Map<number, Judgment>> {
  const input = await claudeStructured(buildPrompt(transcript, items), RESPONSE_SCHEMA, TOOL_NAME, apiKey);
  const raw = coerceArrayField(input, 'items') as { index?: number; voiced?: boolean; evidence?: string }[];
  const out = new Map<number, Judgment>();
  for (const j of raw) {
    if (typeof j.index !== 'number' || typeof j.voiced !== 'boolean') continue;
    out.set(j.index, { voiced: j.voiced, ...(j.voiced && j.evidence?.trim() ? { evidence: j.evidence.trim() } : {}) });
  }
  const missing = items.map((_, i) => i + 1).filter((i) => !out.has(i));
  if (missing.length > 0) {
    throw new Error(
      `judge omitted ${missing.length}/${items.length} items (indices ${missing.slice(0, 5).join(', ')}…)`
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-case tagging
// ---------------------------------------------------------------------------
interface CaseJson {
  caseId?: string;
  transcript: string;
  gold: GoldData;
}

function sectionCounts(items: TagItem[], judged?: Map<number, Judgment>): string {
  return SECTIONS.map((sec) => {
    const idx = items.map((it, i) => ({ it, i })).filter(({ it }) => it.section === sec);
    if (idx.length === 0) return `${sec} —`;
    if (!judged) return `${sec} ${idx.length}`;
    const voiced = idx.filter(({ i }) => judged.get(i + 1)?.voiced).length;
    return `${sec} ${voiced}/${idx.length}`;
  }).join(', ');
}

async function tagCase(casePath: string, apiKey: string, force: boolean): Promise<string> {
  const rawText = readFileSync(casePath, 'utf8');
  const caseJson = JSON.parse(rawText) as CaseJson;
  const caseId = caseJson.caseId ?? casePath.replace(/^.*\//, '').replace('.json', '');
  const items = collectItems(caseJson.gold);
  if (items.length === 0) return `${caseId}: no taggable items`;
  if (!force && items.every(isTagged)) return `${caseId}: already tagged (skipped; use --force to re-tag)`;

  const judged = await judgeCase(caseJson.transcript, items, apiKey);
  for (let i = 0; i < items.length; i++) {
    const j = judged.get(i + 1)!;
    items[i].ref.voiced = j.voiced;
    if (j.voiced && j.evidence) items[i].ref.voicedEvidence = j.evidence;
    else delete items[i].ref.voicedEvidence; // keep re-tagging idempotent
  }
  // Preserve the file's trailing-newline convention; all untouched fields round-trip as-is.
  writeFileSync(casePath, JSON.stringify(caseJson, null, 2) + (rawText.endsWith('\n') ? '\n' : ''));

  const totalVoiced = items.filter((_, i) => judged.get(i + 1)!.voiced).length;
  return `${caseId}: voiced ${totalVoiced}/${items.length} | ${sectionCounts(items, judged)}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));
  const casesDir = positional[0] ?? 'scripts/easy-chart-eval/harvested-cases';
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

  let files = readdirSync(casesDir)
    .filter((f) => /^case\d+\.json$/.test(f))
    .sort();
  if (only) files = files.filter((f) => only.has(f.replace('.json', '')));
  console.log(
    `${files.length} case files in ${casesDir}${only ? ' (--cases filter active)' : ''}${dryRun ? ' [DRY RUN]' : ''}`
  );

  if (dryRun) {
    // Enumerate what WOULD be tagged and exit before touching the API (no key required).
    let toTag = 0;
    for (const f of files) {
      const caseJson = JSON.parse(readFileSync(join(casesDir, f), 'utf8')) as CaseJson;
      const caseId = caseJson.caseId ?? f.replace('.json', '');
      const items = collectItems(caseJson.gold);
      const fullyTagged = items.length > 0 && items.every(isTagged);
      const skip = items.length === 0 || (fullyTagged && !force);
      if (!skip) toTag++;
      console.log(
        `${caseId}: ${items.length} items (${sectionCounts(items)})` +
          (items.length === 0
            ? ' — nothing to tag'
            : fullyTagged
            ? force
              ? ' — already tagged, WOULD re-tag (--force)'
              : ' — already tagged, would skip'
            : ' — WOULD tag')
      );
    }
    console.log(
      `\ndry run: ${toTag} of ${files.length} cases would be sent to the judge (1 LLM call each). No API calls made.`
    );
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error(
      'Missing env: ANTHROPIC_API_KEY (run under `npx env-cmd -f packages/zambdas/.env/local.json`, or use --dry-run)'
    );

  const CONCURRENCY = 3;
  const lines: string[] = new Array(files.length);
  let failed = 0;
  let idx = 0;
  async function worker(): Promise<void> {
    while (idx < files.length) {
      const i = idx++;
      const f = files[i];
      try {
        lines[i] = await tagCase(join(casesDir, f), apiKey!, force);
      } catch (e) {
        failed++;
        lines[i] = `${f.replace('.json', '')}: FAILED (${e instanceof Error ? e.message : String(e)})`;
      }
      console.log(lines[i]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(
    `\ndone: ${files.length - failed} ok, ${failed} failed${
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
