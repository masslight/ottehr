/**
 * The per-case report of what the plan predicted, as one HTML page — the renderer, the per-action judge and
 * the classification, shared by autochart-report.ts (a standalone run) and test-autochart-plan.ts (`--report`).
 *
 * Per case: every action the plan emitted with the judge's reading of it against the transcript (supported /
 * unsupported / contradicted), the verbatim phrase the server verified for it (`sourceText`) in context, and
 * what it is relative to the signed chart; then the chart's said items and whether the plan charted them; the
 * guards' refusals; the narrative read-back. The same matching as the suites (autochart-shared.ts).
 */

import type { NarrativeLine, PlannedAction } from 'utils/lib/easy-chart/api';
import { AutochartCase, Expectation, TaggedExpectation } from './autochart-case-file';
import {
  actionMatches,
  checkPlan,
  describeExpectation,
  isClassNamedMedication,
  Refusal,
  resolveExamField,
  resolveRosBaseKey,
  summarizeAction,
} from './autochart-shared';
import { callGemini } from './shared';

/** Where the judge runs. */
export interface GeminiConfig {
  projectId: string;
  apiKey: string;
  model: string;
}

/** The judge the suites use unless `--judge-model` names another: the product's own model. */
export const DEFAULT_JUDGE_MODEL = 'gemini-3.1-flash-lite';

export const geminiFromArgs = (envConfig: Record<string, string>, argv: string[]): GeminiConfig => {
  const at = argv.indexOf('--judge-model');
  return {
    projectId: envConfig.GOOGLE_CLOUD_PROJECT_ID,
    apiKey: envConfig.GOOGLE_CLOUD_API_KEY,
    model: at !== -1 ? argv[at + 1] : DEFAULT_JUDGE_MODEL,
  };
};

type Verdict =
  | 'voiced chart item'
  | 'said item'
  | 'unvoiced chart item'
  | 'context item'
  | 'allowed'
  | 'class-named drug'
  | 'ROS/exam not in chart'
  | 'extra'
  | 'E&M level differs from chart'
  | 'disposition differs from chart'
  | 'instruction / note / template (not scored)';

interface ActionRow {
  summary: string;
  /** HTML: the action as a person reads it, from its own fields (`actionCell`). */
  cell: string;
  kind: string;
  verdict: Verdict;
  /** Whether the recording carries the action's own wording; undefined for actions without one. */
  inTranscript?: boolean;
  evidence?: Evidence;
  /** The verbatim phrase the server verified against the recording (`PlannedAction.sourceText`); absent = inferred. */
  sourceText?: string;
  sourceOrigin?: string;
  /** HTML: the recording around the verified quote, the quote marked. */
  sourceSnippet?: string;
  caution?: string;
  judge?: JudgeRow;
}

interface SaidRow {
  text: string;
  /** Where the recording says it, by a word of the item's label. */
  evidence?: Evidence;
  /** The verified quote of the action that charted it, when one did. */
  sourceText?: string;
  /** The gold section the item comes from, or "recording" for the case file's own said items. */
  from: string;
  inGold: boolean;
  predicted: boolean;
  by?: string;
  detail?: string;
}

/** The judge's reading of one action against the transcript. */
export interface JudgeRow {
  index: number;
  verdict: 'supported' | 'unsupported' | 'contradicted';
  reason: string;
}

export interface RawCase {
  id: string;
  actions: PlannedAction[];
  refusals: Refusal[];
  models: string[];
  narrative: NarrativeLine[];
  /** Absent when the judge did not run; filled in on the next render unless --skip-judge. */
  judge?: JudgeRow[];
  error?: string;
}

/** The kinds the judge reads: assertions about the patient and the plan, not note text or templates. */
const JUDGED_KINDS = new Set([
  'add-diagnosis',
  'add-ros-finding',
  'add-exam-finding',
  'add-medication',
  'add-condition',
  'add-allergy',
  'add-surgical-history',
  'add-hospitalization',
  'set-vital',
  'set-disposition',
  'add-patient-instruction',
]);

const withoutSpeakerLabels = (transcript: string): string =>
  transcript.replace(/\b(?:Provider|Patient|Doctor|Nurse|Parent|Mother|Father|Speaker \d+):\s*/g, '');

/** An action in plain words for the judge: what is being charted, not the product's field names. */
function describeForJudge(a: PlannedAction): string {
  const d = `${a.display ?? ''}`.trim();
  switch (a.kind) {
    case 'add-diagnosis':
      return `diagnosis${a.isPrimary ? ' (primary)' : ''}: ${d} (${a.code ?? ''})`;
    case 'add-ros-finding':
      return `review of systems: ${d}`;
    case 'add-exam-finding':
      return `exam finding: ${d}`;
    case 'add-medication':
      return `medication charted: ${d}${a.strength ? ` ${a.strength}` : ''}`;
    case 'add-condition':
      return `history / condition: ${d} (${a.code ?? ''})`;
    case 'add-allergy':
      return `allergy: ${d}`;
    case 'add-surgical-history':
      return `surgical history: ${d}`;
    case 'add-hospitalization':
      return `hospitalization: ${d}`;
    case 'set-vital':
      return `vital sign ${a.field ?? ''}: ${d || `${a.value ?? ''} ${a.unit ?? ''}`}`;
    case 'set-disposition':
      return `disposition / follow-up plan: ${d}${
        a.followUpInDays !== undefined ? ` (follow up in ${a.followUpInDays} days)` : ''
      }`;
    case 'add-patient-instruction':
      return `patient instruction: ${`${a.text ?? ''}`.trim()}`;
    default:
      return `${a.kind}: ${d}`;
  }
}

/**
 * A Gemini judge reads every judged action against the transcript: supported (stated or clearly implied,
 * clinical term for a lay phrase included), unsupported (nothing in the transcript says or implies it), or
 * contradicted. One call per case; the verdicts are cached with the run.
 */
export async function judgeActions(
  transcript: string,
  actions: PlannedAction[],
  gemini: GeminiConfig
): Promise<JudgeRow[]> {
  const judged = actions.map((a, index) => ({ a, index })).filter(({ a }) => JUDGED_KINDS.has(a.kind));
  if (!judged.length) return [];
  const list = judged.map(({ a, index }) => `${index}. ${describeForJudge(a)}`).join('\n');
  const prompt = `You are checking the chart actions a scribe proposed from the transcript of a clinic visit. For each numbered action decide whether the transcript supports it.

"supported": the transcript states the fact or clearly implies it. A clinical term for a lay phrase counts ("otalgia" for "my ear hurts"); a negative the patient gave counts for a "denies" finding; an instruction the provider gave in other words counts; a diagnosis the provider named or clearly concluded counts, whatever the exact code.
"unsupported": nothing in the transcript says or implies it — the scribe added it on its own.
"contradicted": the transcript says the opposite (a symptom denied written as present, a drug the provider decided against, the other side).

Judge the fact, not the wording, and not whether the code is the most specific one. The speaker labels have been removed from the transcript; work out who is speaking from the content.

Return a JSON array with exactly one object per numbered action: {"index": <the number>, "verdict": "supported" | "unsupported" | "contradicted", "reason": <one short sentence>}.

TRANSCRIPT:
${withoutSpeakerLabels(transcript)}

ACTIONS:
${list}`;
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        index: { type: 'integer' },
        verdict: { type: 'string', enum: ['supported', 'unsupported', 'contradicted'] },
        reason: { type: 'string' },
      },
      required: ['index', 'verdict', 'reason'],
    },
  };
  const text = await callGemini(prompt, gemini.projectId, gemini.apiKey, schema, gemini.model);
  const rows = JSON.parse(text) as JudgeRow[];
  const valid = new Set(judged.map(({ index }) => index));
  return rows.filter((r) => valid.has(r.index));
}

export interface CaseReport {
  c: AutochartCase;
  said: SaidRow[];
  unvoicedPredicted: string[];
  unvoicedTotal: number;
  contextPredicted: string[];
  contextTotal: number;
  actions: ActionRow[];
  refusals: Refusal[];
  narrative: NarrativeLine[];
  models: string[];
  error?: string;
}

const CODED = new Set([
  'add-diagnosis',
  'set-vital',
  'add-medication',
  'add-allergy',
  'add-condition',
  'add-surgical-history',
  'add-hospitalization',
]);
const WORDLESS = new Set([
  'add-patient-instruction',
  'edit-note-text',
  'provider-note',
  'apply-template',
  'set-em-code',
]);
const FILLER = new Set([
  'unspecified',
  'initial',
  'encounter',
  'other',
  'acute',
  'chronic',
  'without',
  'with',
  'left',
  'right',
  'bilateral',
  'disorder',
  'disease',
  'site',
  'specified',
  'history',
  'personal',
  'patient',
  'reports',
  'denies',
  'normal',
  'finding',
  'findings',
  'oral',
  'tablet',
  'solution',
  'suspension',
]);

interface Evidence {
  word: string;
  /** HTML: the recording around the word, the word marked. */
  snippet: string;
}

/** The recording around the first of the words it carries (a stem of four letters or more), the word marked. */
function evidenceFor(words: string[], transcript: string): Evidence | undefined {
  const lower = transcript.toLowerCase();
  for (const w of [...new Set(words)].sort((x, y) => y.length - x.length)) {
    const stem = w.length > 6 ? w.slice(0, w.length - 2) : w;
    const at = lower.indexOf(stem);
    if (at === -1) continue;
    const wordEnd = at + stem.length + (/^[a-z]*/.exec(lower.slice(at + stem.length))?.[0].length ?? 0);
    let start = Math.max(0, at - 90);
    if (start > 0) start = transcript.lastIndexOf(' ', start) + 1;
    let stop = Math.min(transcript.length, wordEnd + 90);
    if (stop < transcript.length) {
      const space = transcript.indexOf(' ', stop);
      if (space !== -1) stop = space;
    }
    return {
      word: w,
      snippet: `${start > 0 ? '…' : ''}${esc(transcript.slice(start, at))}<mark>${esc(
        transcript.slice(at, wordEnd)
      )}</mark>${esc(transcript.slice(wordEnd, stop))}${stop < transcript.length ? '…' : ''}`,
    };
  }
  return undefined;
}

/** The recording around a verbatim quote, the quote marked; the quote alone when it cannot be located. */
function quoteInTranscript(quote: string, transcript: string): string {
  const at = transcript.toLowerCase().indexOf(quote.toLowerCase());
  if (at === -1) return `«${esc(quote)}»`;
  let start = Math.max(0, at - 70);
  if (start > 0) start = transcript.lastIndexOf(' ', start) + 1;
  let stop = Math.min(transcript.length, at + quote.length + 70);
  if (stop < transcript.length) {
    const space = transcript.indexOf(' ', stop);
    if (space !== -1) stop = space;
  }
  return `${start > 0 ? '…' : ''}${esc(transcript.slice(start, at))}<mark>${esc(
    transcript.slice(at, at + quote.length)
  )}</mark>${esc(transcript.slice(at + quote.length, stop))}${stop < transcript.length ? '…' : ''}`;
}

/** Whether the recording carries a word of the action's display or search terms, and where. */
function wordingInTranscript(a: PlannedAction, transcript: string): { inTranscript?: boolean; evidence?: Evidence } {
  if (WORDLESS.has(a.kind)) return {};
  const words = contentWords(`${a.display ?? ''} ${(a.searchTerms ?? []).join(' ')}`);
  if (!words.length) return {};
  const evidence = evidenceFor(words, transcript);
  return { inTranscript: !!evidence, evidence };
}

const matchesAny = (a: PlannedAction, items: Expectation[]): boolean => items.some((e) => actionMatches(a, e));

const KINDS: Record<string, string[]> = {
  diagnosis: ['add-diagnosis'],
  ros: ['add-ros-finding'],
  exam: ['add-exam-finding'],
  vital: ['set-vital'],
  bloodPressure: ['set-vital'],
  medication: ['add-medication'],
  allergy: ['add-allergy'],
  condition: ['add-condition'],
  surgicalHistory: ['add-surgical-history'],
  hospitalization: ['add-hospitalization'],
  em: ['set-em-code'],
  disposition: ['set-disposition'],
  instruction: ['add-patient-instruction'],
  note: ['edit-note-text'],
};
const kindsOf = (e: Expectation): string[] =>
  e.kind === 'anyOf' ? [...new Set(e.of.flatMap(kindsOf))] : KINDS[e.kind] ?? [];

const contentWords = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !FILLER.has(w));

/**
 * What to show beside a missed item: the same-kind actions that share a word with it, the guards' refusals of
 * that kind, and, for a drug, the instruction it landed in — not every action of the kind, which the actions
 * table below already lists.
 */
function briefInstead(t: TaggedExpectation, actions: PlannedAction[], refusals: Refusal[]): string {
  const kinds = new Set(kindsOf(t.expectation));
  const words = new Set(contentWords(`${describeExpectation(t.expectation)} ${t.label ?? ''}`));
  const overlaps = (text: string): boolean => contentWords(text).some((w) => words.has(w));
  const same = actions.filter((a) => kinds.has(a.kind));
  const parts: string[] = [];
  const similar = same.filter((a) => overlaps(`${a.display ?? ''} ${(a.searchTerms ?? []).join(' ')} ${a.code ?? ''}`));
  if (similar.length) parts.push(`similar: ${similar.map((a) => summarizeAction(a).replace(/^\S+ /, '')).join(' | ')}`);
  const refused = refusals.filter((r) => kinds.has(r.kind) && overlaps(r.display ?? ''));
  if (refused.length) parts.push(`refused: ${refused.map((r) => `${r.display ?? ''}: ${r.reason}`).join(' | ')}`);
  if (t.expectation.kind === 'medication') {
    const name = t.expectation.name;
    const mentions = actions.filter(
      (a) =>
        (a.kind === 'add-patient-instruction' || a.kind === 'provider-note') &&
        name.test(`${a.text ?? a.message ?? ''}`)
    );
    if (mentions.length)
      parts.push(
        `landed as text: ${mentions.map((a) => `"${`${a.text ?? a.message ?? ''}`.slice(0, 90)}"`).join(' | ')}`
      );
  }
  if (!parts.length) {
    parts.push(
      same.length
        ? `nothing similar among the ${same.length} ${[...kinds].join('/')} action(s) charted`
        : 'nothing of this kind charted'
    );
  }
  return parts.join('; ');
}

function verdictOf(a: PlannedAction, c: AutochartCase): Verdict {
  const by = (tag: TaggedExpectation['tag']): Expectation[] =>
    c.expected.filter((t) => t.tag === tag).map((t) => t.expectation);
  if (matchesAny(a, by('voiced'))) return 'voiced chart item';
  if (matchesAny(a, by('said'))) return 'said item';
  if (matchesAny(a, by('unvoiced'))) return 'unvoiced chart item';
  if (
    matchesAny(
      a,
      c.context.map((t) => t.expectation)
    )
  )
    return 'context item';
  if (matchesAny(a, c.allowed)) return 'allowed';
  if (isClassNamedMedication(a)) return 'class-named drug';
  if (a.kind === 'add-ros-finding' || a.kind === 'add-exam-finding') return 'ROS/exam not in chart';
  if (CODED.has(a.kind)) return 'extra';
  if (a.kind === 'set-em-code') return 'E&M level differs from chart';
  if (a.kind === 'set-disposition') return 'disposition differs from chart';
  return 'instruction / note / template (not scored)';
}

export function buildReport(c: AutochartCase, raw: RawCase): CaseReport {
  const report: CaseReport = {
    c,
    said: [],
    unvoicedPredicted: [],
    unvoicedTotal: 0,
    contextPredicted: [],
    contextTotal: 0,
    actions: [],
    refusals: raw.refusals,
    narrative: raw.narrative,
    models: raw.models,
    error: raw.error,
  };
  const checks = checkPlan(c, raw.actions, raw.refusals);
  const items = [...c.expected, ...c.context];
  items.forEach((t, i) => {
    const check = checks[i];
    const by = raw.actions.find((a) => actionMatches(a, t.expectation));
    const text = `${describeExpectation(t.expectation)}${t.label ? ` «${t.label}»` : ''}`;
    if (t.tag === 'voiced' || t.tag === 'said') {
      report.said.push({
        text,
        evidence: evidenceFor(contentWords(`${describeExpectation(t.expectation)} ${t.label ?? ''}`), c.transcript),
        sourceText: by?.sourceText,
        from: t.tag === 'said' ? 'recording (case file)' : t.from,
        inGold: t.tag === 'voiced',
        predicted: check.passed,
        by: by ? summarizeAction(by) : undefined,
        detail: check.passed ? undefined : briefInstead(t, raw.actions, raw.refusals),
      });
    } else if (t.tag === 'unvoiced') {
      report.unvoicedTotal += 1;
      if (check.passed) report.unvoicedPredicted.push(text);
    } else {
      report.contextTotal += 1;
      if (check.passed) report.contextPredicted.push(text);
    }
  });
  const judged = new Map((raw.judge ?? []).map((j) => [j.index, j]));
  report.actions = raw.actions.map((a, index) => ({
    summary: summarizeAction(a),
    cell: actionCell(a),
    kind: a.kind,
    verdict: verdictOf(a, c),
    ...wordingInTranscript(a, c.transcript),
    sourceText: a.sourceText,
    sourceOrigin: a.sourceOrigin,
    sourceSnippet: a.sourceText ? quoteInTranscript(a.sourceText, c.transcript) : undefined,
    caution: a.caution,
    judge: judged.get(index),
  }));
  return report;
}

// ── HTML ──────────────────────────────────────────────────────────────────────

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pct = (a: number, b: number): string => (b ? `${Math.round((100 * a) / b)}%` : '—');

/**
 * The action as a person reads it, from its own fields, by kind: a note edit is its field and the text it
 * writes there, an instruction its text, a finding its display, its search terms and where it lands in the
 * product's catalogue, a coded item its code and display.
 */
export function actionCell(a: PlannedAction): string {
  const terms = a.searchTerms?.length ? ` <span class="muted small">[${esc(a.searchTerms.join('; '))}]</span>` : '';
  const primary = a.isPrimary ? ' <span class="swatch note">primary</span>' : '';
  switch (a.kind) {
    case 'edit-note-text':
      return `<span class="muted small">note field</span> <b>${esc(a.field)}</b>: ${esc(a.newText)}`;
    case 'add-patient-instruction':
      return `<span class="muted small">instruction</span> ${esc(a.text)}`;
    case 'provider-note':
      return `<span class="muted small">note to the provider</span> ${esc(a.message)}`;
    case 'apply-template':
      return `<span class="muted small">template</span> ${esc(a.display)}${
        a.templateId ? ` <span class="muted small">(${esc(a.templateId)})</span>` : ''
      }`;
    case 'set-em-code':
      return `${esc(a.code)} ${esc(a.display ?? '')}`;
    case 'set-vital':
      return `<b>${esc(a.field)}</b> ${esc(a.display ?? `${a.value ?? ''} ${a.unit ?? ''}`)}`;
    case 'set-disposition':
      return `${esc(a.display ?? '')} <span class="muted small">(${esc(a.dispositionType ?? '')}${
        a.followUpInDays !== undefined ? `, follow up in ${a.followUpInDays} days` : ''
      })</span>`;
    case 'add-ros-finding':
    case 'add-exam-finding': {
      const key = a.kind === 'add-ros-finding' ? resolveRosBaseKey(a) : resolveExamField(a);
      return `${esc(a.display ?? '')}${terms} <span class="muted small">→ ${esc(key ?? 'unresolved')}</span>`;
    }
    default:
      return `${a.code ? `${esc(a.code)} ` : ''}${esc(a.display ?? '')}${
        a.strength ? ` ${esc(a.strength)}` : ''
      }${primary}${terms}`;
  }
}

const VERDICT_CLASS: Record<Verdict, string> = {
  'voiced chart item': 'ok',
  'said item': 'ok',
  'unvoiced chart item': 'note',
  'context item': 'note',
  allowed: 'note',
  'class-named drug': 'note',
  'ROS/exam not in chart': 'warn',
  extra: 'bad',
  'E&M level differs from chart': 'warn',
  'disposition differs from chart': 'warn',
  'instruction / note / template (not scored)': 'muted',
};

export interface Numbers {
  actions: number;
  quoted: number;
  quotable: number;
  judged: number;
  supported: number;
  unsupported: number;
  contradicted: number;
  /** Judged actions the judge supports that are chart items. */
  supportedInChart: number;
  /** Judged actions the judge supports that are not chart items (said, not charted). */
  supportedNotInChart: number;
  extras: number;
  extrasSupported: number;
  saidTotal: number;
  saidPredicted: number;
}

const IN_CHART = new Set<Verdict>(['voiced chart item', 'said item', 'unvoiced chart item', 'context item', 'allowed']);
const UNQUOTABLE_KINDS = new Set(['set-em-code', 'apply-template']);

export function caseNumbers(r: CaseReport): Numbers {
  const judged = r.actions.filter((a) => a.judge);
  const supported = judged.filter((a) => a.judge?.verdict === 'supported');
  const extras = r.actions.filter((a) => a.verdict === 'extra');
  return {
    actions: r.actions.length,
    quoted: r.actions.filter((a) => a.sourceText).length,
    quotable: r.actions.filter((a) => !UNQUOTABLE_KINDS.has(a.kind)).length,
    judged: judged.length,
    supported: supported.length,
    unsupported: judged.filter((a) => a.judge?.verdict === 'unsupported').length,
    contradicted: judged.filter((a) => a.judge?.verdict === 'contradicted').length,
    supportedInChart: supported.filter((a) => IN_CHART.has(a.verdict)).length,
    supportedNotInChart: supported.filter((a) => !IN_CHART.has(a.verdict)).length,
    extras: extras.length,
    extrasSupported: extras.filter((a) => a.judge?.verdict === 'supported').length,
    saidTotal: r.said.length,
    saidPredicted: r.said.filter((s) => s.predicted).length,
  };
}

const JUDGE_CLASS: Record<JudgeRow['verdict'], string> = { supported: 'ok', unsupported: 'bad', contradicted: 'bad' };

function renderCase(r: CaseReport, index: number): string {
  const n = caseNumbers(r);
  const c = r.c;
  const paragraphs = c.transcript
    .split(/(?=\b(?:Provider|Patient):)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const actionRows = r.actions
    .map((a) => {
      const said = a.judge
        ? `<b class="${JUDGE_CLASS[a.judge.verdict]}-ink">${esc(a.judge.verdict)}</b><span class="evidence">${esc(
            a.judge.reason
          )}</span>`
        : '<span class="muted">not judged</span>';
      const source = a.sourceText
        ? `${
            a.sourceOrigin && a.sourceOrigin !== 'narrative'
              ? `<span class="small muted">from the ${esc(a.sourceOrigin)}: </span>`
              : ''
          }${a.sourceSnippet}`
        : UNQUOTABLE_KINDS.has(a.kind)
        ? '<span class="muted">—</span>'
        : `<span class="muted">none — inferred</span>${
            a.inTranscript === true && a.evidence
              ? `<span class="evidence">wording found: ${a.evidence.snippet}</span>`
              : ''
          }`;
      const caution = a.caution ? `<span class="evidence">⚠ ${esc(a.caution)}</span>` : '';
      const rowClass = a.judge
        ? JUDGE_CLASS[a.judge.verdict]
        : a.sourceText
        ? 'ok'
        : VERDICT_CLASS[a.verdict] === 'muted'
        ? 'muted'
        : 'warn';
      return `<tr class="${rowClass}">
        <td class="small">${esc(a.kind)}</td>
        <td>${a.cell}${caution}</td>
        <td class="small">${said}</td>
        <td class="small">${source}</td>
        <td class="small">${esc(a.verdict)}</td></tr>`;
    })
    .join('');
  const saidRows = r.said
    .map((s) => {
      const under = s.sourceText
        ? `<span class="evidence">plan's verified quote: «${esc(s.sourceText)}»</span>`
        : s.evidence
        ? `<span class="evidence">said here: ${s.evidence.snippet}</span>`
        : '';
      return `<tr class="${s.predicted ? 'ok' : 'bad'}">
        <td>${esc(s.text)}${under}</td>
        <td class="small">${esc(s.from)}</td>
        <td>${s.predicted ? '✓' : '✗'}</td>
        <td class="small">${esc(s.predicted ? s.by : s.detail)}</td></tr>`;
    })
    .join('');
  const refusals = r.refusals.length
    ? `<ul class="plain">${r.refusals
        .map((x) => `<li><b>${esc(x.kind)}</b> ${esc(x.display ?? '')} — ${esc(x.reason)}</li>`)
        .join('')}</ul>`
    : '<p class="muted">none</p>';
  const narrative = r.narrative.length
    ? `<ol class="narrative">${r.narrative
        .map((l) => `<li class="${l.sources.length ? '' : 'unbacked'}">${esc(l.text)}</li>`)
        .join('')}</ol><p class="small muted">Lines the server could not back with a transcript snippet are marked.</p>`
    : '<p class="muted">not run</p>';
  const judgeTile = n.judged
    ? `<div class="tile"><div class="num">${n.supported}/${
        n.judged
      }</div><div class="lbl">actions the judge finds said in the recording (${pct(n.supported, n.judged)}) — ${
        n.unsupported
      } not said, ${n.contradicted} contradicted</div></div>`
    : '';
  return `<section class="case" id="${esc(c.id)}">
    <h2><span class="index">${index + 1}</span> ${esc(c.label)}</h2>
    <p class="meta">${esc(c.id)} · corpus ${esc(c.sourceCase)} · ${esc(
      c.status
    )} patient · ${c.transcript.length.toLocaleString()} characters · ${r.actions.length} actions · model ${esc(
      r.models.join(', ') || '—'
    )}</p>
    ${r.error ? `<p class="error">Error: ${esc(r.error)}</p>` : ''}
    <div class="tiles">
      ${judgeTile}
      <div class="tile"><div class="num">${n.quoted}/${
        n.quotable
      }</div><div class="lbl">actions with a server-verified quote (${pct(n.quoted, n.quotable)})</div></div>
      <div class="tile"><div class="num">${n.supportedInChart}/${
        n.supported
      }</div><div class="lbl">of the said actions, in the clinician's chart — ${
        n.supportedNotInChart
      } said but not charted by the clinician</div></div>
      <div class="tile"><div class="num">${n.saidPredicted}/${
        n.saidTotal
      }</div><div class="lbl">reference: the chart's said items the plan charted (${pct(
        n.saidPredicted,
        n.saidTotal
      )})</div></div>
    </div>
    <details><summary>Transcript</summary><div class="transcript">${paragraphs
      .map((p) => `<p>${esc(p)}</p>`)
      .join('')}</div></details>
    <h3>What the plan predicted, and whether it was said</h3>
    <p class="small muted">Every action the plan emitted, in its order. "Said in the recording" is the judge's reading of the action against the transcript — supported (stated or clearly implied), unsupported (nothing says or implies it), contradicted — with its reason; note text, templates and the E&amp;M level are not judged. "Verified quote" is the verbatim phrase the server checked against the recording for the action (<code>sourceText</code>), in context; "none — inferred" is what the product shows the provider. "In the chart" is the reference: what the action is relative to the chart the clinician signed — <span class="swatch ok">a chart item that was said</span>, <span class="swatch note">a chart item not said, a context item, an allowed item or a class-named drug</span>, <span class="swatch warn">a ROS/exam finding the chart lacks, or an E&amp;M / disposition that differs</span>, <span class="swatch bad">an extra: a coded fact the chart does not have</span>, <span class="swatch muted">note or template text</span>. Row colour follows the judge.</p>
    <div class="scroll"><table><thead><tr><th>Kind</th><th>Action</th><th>Said in the recording (judge)</th><th>Verified quote (server)</th><th>In the chart (reference)</th></tr></thead><tbody>${actionRows}</tbody></table></div>
    <h3>Refused by the guards</h3>${refusals}
    <h3>Reference: the clinician's chart, what of it was said, and whether the plan charted it</h3>
    <p class="small muted">Rows come from the signed chart in the case file — <code>gold.assessment.diagnoses</code>, <code>reviewOfSystems</code>, <code>exam</code>, <code>billing.emCode</code>, <code>medications.prescribed</code>, <code>disposition</code> — keeping the items the harvester flagged as said on the recording, plus the case file's own <code>said</code> items. The chart is a reference, not the truth: the clinician may have charted something else than what was said. "Charted" means some plan action resolves to the item the way the product resolves it; a miss shows the nearest thing the plan charted of that kind, or why the guards refused it.</p>
    <div class="scroll"><table><thead><tr><th>Chart item</th><th>Section</th><th>Charted by the plan</th><th>By / instead</th></tr></thead><tbody>${saidRows}</tbody></table></div>
    <p class="small">Chart items never said on the recording: ${r.unvoicedTotal}, of which the plan charted ${
      r.unvoicedPredicted.length
    }${
      r.unvoicedPredicted.length ? ` (${esc(r.unvoicedPredicted.join('; '))})` : ''
    }. Items entered outside the recording (vitals, intake history): ${r.contextTotal}, charted ${
      r.contextPredicted.length
    }.</p>
    <h3>Narrative read-back</h3>${narrative}
  </section>`;
}

export function renderPage(reports: CaseReport[]): string {
  const keys: (keyof Numbers)[] = [
    'actions',
    'quoted',
    'quotable',
    'judged',
    'supported',
    'unsupported',
    'contradicted',
    'supportedInChart',
    'supportedNotInChart',
    'extras',
    'extrasSupported',
    'saidTotal',
    'saidPredicted',
  ];
  const totals = reports
    .map(caseNumbers)
    .reduce(
      (acc, n) => Object.fromEntries(keys.map((k) => [k, acc[k] + n[k]])) as unknown as Numbers,
      Object.fromEntries(keys.map((k) => [k, 0])) as unknown as Numbers
    );
  const summaryRows = reports
    .map((r, i) => {
      const n = caseNumbers(r);
      return `<tr><td><a href="#${esc(r.c.id)}">${i + 1}. ${esc(r.c.label)}</a></td><td>${n.actions}</td><td>${
        n.judged ? `${n.supported}/${n.judged} <span class="muted">(${pct(n.supported, n.judged)})</span>` : '—'
      }</td><td>${n.unsupported + n.contradicted}</td><td>${n.quoted}/${n.quotable}</td><td>${n.supportedInChart}/${
        n.supported
      }</td><td>${n.saidPredicted}/${n.saidTotal}</td></tr>`;
    })
    .join('');
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `<title>Autochart Case Review</title>
<style>
:root{--bg:#f7f6f2;--panel:#ffffff;--ink:#1f2a2e;--muted:#5d6b70;--line:#d9d6cc;--accent:#0f6e73;--ok:#e6f4ea;--ok-ink:#1e6b3a;--bad:#fbe9e7;--bad-ink:#9b2c1f;--warn:#fff4dc;--warn-ink:#7a5200;--note:#eef3f8;--note-ink:#2c4a6b;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15191b;--panel:#1d2325;--ink:#e6e9e6;--muted:#9aa6a9;--line:#323b3e;--accent:#6cc6c9;--ok:#173424;--ok-ink:#9fd7b2;--bad:#3a1d18;--bad-ink:#f0a89c;--warn:#3a2f12;--warn-ink:#ffd27a;--note:#1c2a38;--note-ink:#a9c4e0;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#15191b;--panel:#1d2325;--ink:#e6e9e6;--muted:#9aa6a9;--line:#323b3e;--accent:#6cc6c9;--ok:#173424;--ok-ink:#9fd7b2;--bad:#3a1d18;--bad-ink:#f0a89c;--warn:#3a2f12;--warn-ink:#ffd27a;--note:#1c2a38;--note-ink:#a9c4e0;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:15px/1.5 "IBM Plex Sans",system-ui,sans-serif;margin:0}
main{max-width:1080px;margin:0 auto;padding-block:32px 64px;padding-inline:16px}
h1{font-size:28px;margin:0 0 4px;text-wrap:balance}
h2{font-size:20px;margin:0 0 4px;text-wrap:balance}
h3{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:24px 0 8px}
.lede{color:var(--muted);margin:0 0 24px;max-width:70ch}
.meta,.small{font-size:13px}
.muted{color:var(--muted)}
.error{color:var(--bad-ink);background:var(--bad);padding:8px 12px;border-radius:6px}
.case{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;margin-top:24px}
.index{display:inline-block;min-width:1.6em;text-align:center;background:var(--accent);color:var(--bg);border-radius:6px;font-size:14px;margin-right:6px;font-variant-numeric:tabular-nums}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:12px 0 16px}
.tile{border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.num{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.lbl{font-size:12px;color:var(--muted)}
.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--line)}
th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
tr.ok td:nth-child(3),tr.ok td:nth-child(2):first-child{color:var(--ok-ink)}
tr.ok{background:var(--ok)}tr.bad{background:var(--bad)}tr.warn{background:var(--warn)}tr.note{background:var(--note)}tr.muted td{color:var(--muted)}
.swatch{padding:1px 6px;border-radius:4px;white-space:nowrap}.swatch.ok{background:var(--ok);color:var(--ok-ink)}.swatch.note{background:var(--note);color:var(--note-ink)}.swatch.warn{background:var(--warn);color:var(--warn-ink)}.swatch.bad{background:var(--bad);color:var(--bad-ink)}.swatch.muted{color:var(--muted);border:1px solid var(--line)}
code{font-size:12px;background:var(--note);padding:0 4px;border-radius:3px}
.ok-ink{color:var(--ok-ink)}.bad-ink{color:var(--bad-ink)}
mark{background:var(--warn);color:inherit;padding:0 2px;border-radius:2px}
.evidence{display:block;font-size:12px;color:var(--muted);margin-top:2px;line-height:1.35}
details{margin:8px 0}
summary{cursor:pointer;color:var(--accent);font-weight:600}
.transcript{max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-top:8px;font-size:13.5px}
.transcript p{margin:0 0 8px}
ol.narrative{padding-left:22px}
ol.narrative li.unbacked{color:var(--warn-ink)}
ul.plain{padding-left:18px}
a{color:var(--accent)}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<main>
<h1>Autochart Case Review</h1>
<p class="lede">What the plan charted from each recording, and whether each thing it charted was said. ${
    reports.length
  } cases, ${date} UTC. Two readings of "said": a Gemini judge reads every assertion the plan made against the transcript, and the server's own verification (<code>sourceText</code>, the verbatim phrase it found for the action). The chart the clinician signed is shown as a reference only — clinicians chart what was not said and skip what was — so it is the last column and the last table, not the score.</p>
<div class="tiles">
  <div class="tile"><div class="num">${totals.supported}/${
    totals.judged
  }</div><div class="lbl">actions said in the recording, by the judge (${pct(totals.supported, totals.judged)}) — ${
    totals.unsupported
  } not said, ${totals.contradicted} contradicted</div></div>
  <div class="tile"><div class="num">${totals.quoted}/${
    totals.quotable
  }</div><div class="lbl">actions with a server-verified quote (${pct(totals.quoted, totals.quotable)})</div></div>
  <div class="tile"><div class="num">${totals.supportedInChart}/${
    totals.supported
  }</div><div class="lbl">of the said actions, in the clinician's chart — ${
    totals.supportedNotInChart
  } said but not charted by the clinician</div></div>
  <div class="tile"><div class="num">${totals.saidPredicted}/${
    totals.saidTotal
  }</div><div class="lbl">reference: the charts' said items the plan charted (${pct(
    totals.saidPredicted,
    totals.saidTotal
  )})</div></div>
</div>
<div class="scroll"><table><thead><tr><th>Case</th><th>Actions</th><th>Said (judge)</th><th>Not said / contradicted</th><th>Verified quote</th><th>Said and in chart</th><th>Reference: chart's said items charted</th></tr></thead><tbody>${summaryRows}</tbody></table></div>
${reports.map(renderCase).join('\n')}
</main>`;
}
