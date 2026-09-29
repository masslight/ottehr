// The seam between the endpoints' PlannedAction[] and the panel's recommendations, in both directions:
// each action becomes the recommendation kind the panel has an editor for (or a generic action row), and
// an edited recommendation becomes the action the executor runs. Pure, so it is unit-tested directly.

import { examCommentTarget } from 'src/features/easy-chart/executor/examComment';
import { describeAction } from 'src/features/easy-chart/executor/labels';
import { classifyMatches } from 'src/features/easy-chart/executor/resolve';
import { ChartSnapshot, ResolvedExamFindingAction } from 'src/features/easy-chart/executor/types';
import { buildExamLeafCatalogue, ExamLeaf } from 'utils/lib/config-helpers/exam-leaves';
import { ActionKind } from 'utils/lib/easy-chart/actions';
import { ChartPlanResponse, NarrativeLine, PlannedAction, RejectedAction } from 'utils/lib/easy-chart/api';
import {
  buildRosCatalogue,
  findExamLeafMatches,
  findRosMatches,
  RosCatalogueEntry,
} from 'utils/lib/easy-chart/matchers';
import { chartKeyForNoteField, NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { findingPolarity, locateQuote } from 'utils/lib/easy-chart/provenance';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { locateGeneratedLines } from './narrativeLines';
import { HPI_FIELD, normalizeName, resolvedExamLeaf, wordCount } from './scribeSections';
import {
  EvidenceOrigin,
  ExamResolution,
  LocatedLine,
  NoteMode,
  ScribeAnalysis,
  ScribeRecommendation,
  ScribeSectionKey,
} from './types';

export interface AnalysisContext {
  /** The note fields as written now, by clinical name (what `buildNoteContextFromChart` returns). */
  written: Record<string, string | undefined>;
  /** Injectable for tests; defaults to the ROS config's catalogue. */
  rosCatalogue?: RosCatalogueEntry[];
  /** Injectable for tests; defaults to the leaves of the default exam config. */
  examCatalogue?: ExamLeaf[];
  /** The text the planner verified its quotes against, to trace each quote to its transcript snippets. */
  narrative?: string;
  /** The generated narrative before the provider's edits, to trace a quote on to its transcript snippets. */
  narrativeGenerated?: NarrativeLine[];
  /** The planner was sent the transcript, so a narrative-origin quote is a transcript snippet. */
  narrativeIsTranscript?: boolean;
}

/** Kinds that speak to the provider rather than chart anything; shown as notes. */
const CHAT_ONLY: ReadonlySet<string> = new Set<ActionKind>(['provider-note', 'reply', 'unknown']);

export const INFERRED_NOTE = 'Inferred by the assistant — not quoted from the narrative.';

let defaultRosCatalogue: RosCatalogueEntry[] | undefined;
const rosCatalogue = (): RosCatalogueEntry[] => (defaultRosCatalogue ??= buildRosCatalogue());
let defaultExamCatalogue: ExamLeaf[] | undefined;
const examCatalogue = (): ExamLeaf[] => (defaultExamCatalogue ??= buildExamLeafCatalogue(DefaultExamComponentsConfig));

export function sectionForAction(action: PlannedAction): ScribeSectionKey {
  switch (action.kind) {
    case 'apply-template':
      return 'template';
    case 'edit-note-text':
      return action.field === 'ros' ? 'ros' : action.field === 'medicalDecision' ? 'assessment' : 'hpi';
    case 'set-vital':
      return 'vitals';
    case 'add-allergy':
      return 'allergies';
    case 'add-medication':
      return 'medications';
    case 'add-condition':
    case 'add-surgical-history':
    case 'add-hospitalization':
      return 'history';
    case 'add-exam-finding':
      return 'exam';
    case 'add-ros-finding':
      return 'ros';
    case 'add-diagnosis':
    case 'set-em-code':
      return 'assessment';
    default:
      return 'plan';
  }
}

/** The quote, the guard's caution and how the AI got here, as the row shows them on hover. */
function provenanceOf(
  action: PlannedAction,
  narrativeIsTranscript: boolean
): Pick<
  ScribeRecommendation,
  'evidence' | 'warning' | 'note' | 'transcriptSources' | 'chartSources' | 'evidenceOrigin'
> {
  const { sourceText } = action;
  // A chart quote and a transcript quote are shown as such; only a narrative quote is highlighted in
  // the narrative and traced further by `transcriptProvenance`.
  const quotesChart = action.sourceOrigin === 'chart';
  const quotesTranscript = narrativeIsTranscript && action.sourceOrigin !== 'edited-narrative';
  return {
    ...(sourceText && quotesChart
      ? { chartSources: [sourceText], evidenceOrigin: 'chart' as const }
      : sourceText && quotesTranscript
      ? { transcriptSources: [sourceText], evidenceOrigin: 'transcript' as const }
      : { evidence: sourceText }),
    warning: action.caution,
    note: sourceText ? undefined : INFERRED_NOTE,
  };
}

/** The server derives the polarity from the display verb; the fallback reads the same verb. */
function rosFindingOf(action: PlannedAction): RosFindingState {
  if (action.finding === 'denies') return RosFindingState.Denies;
  if (action.finding === 'reports') return RosFindingState.Reports;
  return findingPolarity(action.display ?? '') === 'negated' ? RosFindingState.Denies : RosFindingState.Reports;
}

/** The ROS entry an add-ros-finding confidently resolves to, with the executor's own matcher. */
function resolveRosEntry(action: PlannedAction, catalogue: RosCatalogueEntry[]): RosCatalogueEntry | undefined {
  const matches = findRosMatches(action.display ?? '', catalogue, { searchTerms: action.searchTerms });
  const resolution = classifyMatches(matches);
  return resolution.kind === 'confident' ? (resolution.match.payload as RosCatalogueEntry) : undefined;
}

/**
 * The exam checkbox these words resolve to, with the executor's matcher and ambiguity rule, so the box a
 * row names is the box that gets ticked. A miss names the card whose comment takes the words.
 */
export function resolveExamFinding(
  display: string,
  searchTerms: string[] | undefined,
  leaves: ExamLeaf[] = examCatalogue()
): ExamResolution {
  const resolution = classifyMatches(findExamLeafMatches(display, leaves, { searchTerms }));
  if (resolution.kind === 'confident') return { kind: 'confident', leaf: resolution.match.payload as ExamLeaf };
  if (resolution.kind === 'ambiguous') {
    return {
      kind: 'ambiguous',
      leaf: resolution.match.payload as ExamLeaf,
      alternatives: resolution.alternatives.map((match) => match.payload as ExamLeaf),
    };
  }
  const target = examCommentTarget(display, searchTerms, leaves);
  return target ? { kind: 'none', sectionLabel: target.sectionLabel, commentField: target.field } : { kind: 'none' };
}

/** The second line of a generic row, for kinds whose label alone does not say what will be charted. */
export function actionSecondary(action: PlannedAction): string | undefined {
  switch (action.kind) {
    case 'set-disposition':
      return action.text;
    case 'set-em-code':
      return action.display;
    default:
      return undefined;
  }
}

/** One action as the panel shows it: typed where the panel has an editor for the kind, generic otherwise. */
function toRecommendation(action: PlannedAction, id: string, options: AnalysisContext): ScribeRecommendation {
  const base = {
    id,
    section: sectionForAction(action),
    action,
    ...provenanceOf(action, options.narrativeIsTranscript === true),
  };

  switch (action.kind) {
    case 'apply-template':
      if (action.display) {
        return { ...base, kind: 'template', templateName: action.display, templateId: action.templateId };
      }
      break;
    case 'edit-note-text': {
      const field = action.field as keyof typeof NOTE_FIELD_LABELS | undefined;
      if (field && field in NOTE_FIELD_LABELS && typeof action.newText === 'string') {
        // Text the provider already wrote is never overwritten unasked; the row says how much is there.
        const existingWords = wordCount(options.written[field] ?? '');
        return {
          ...base,
          kind: 'hpi',
          field,
          text: action.newText,
          ...(existingWords > 0 ? { existingWords } : {}),
        };
      }
      break;
    }
    case 'set-vital':
      // Weight is the one vital with an editor; the guard canonicalised its unit to lb or kg.
      if (action.field === 'vital-weight' && typeof action.value === 'number') {
        if (action.unit === 'lb') return { ...base, kind: 'vital-weight', weightLbs: action.value };
        if (action.unit === 'kg') {
          return { ...base, kind: 'vital-weight', weightLbs: Math.round(action.value * LBS_IN_KG * 10) / 10 };
        }
      }
      break;
    case 'add-allergy':
      if (action.display) return { ...base, kind: 'allergy', name: action.display };
      break;
    case 'add-medication':
      if (action.display) {
        return {
          ...base,
          kind: 'medication',
          name: action.display,
          ...(action.strength ? { strength: action.strength } : {}),
          ...(action.doseForm ? { doseForm: action.doseForm } : {}),
        };
      }
      break;
    case 'add-diagnosis':
      if (action.code && action.display) {
        return {
          ...base,
          kind: 'diagnosis',
          code: action.code,
          display: action.display,
          ...(action.sourceText ? { transcriptTerm: action.sourceText } : {}),
          isPrimary: action.isPrimary === true,
        };
      }
      break;
    case 'add-ros-finding': {
      const entry = resolveRosEntry(action, options.rosCatalogue ?? rosCatalogue());
      if (entry) {
        return {
          ...base,
          kind: 'ros',
          baseKey: entry.baseField,
          label: entry.label,
          systemLabel: entry.systemLabel,
          finding: rosFindingOf(action),
        };
      }
      break;
    }
    case 'add-exam-finding':
      if (action.display) {
        return {
          ...base,
          kind: 'exam',
          display: action.display,
          ...(action.searchTerms ? { searchTerms: action.searchTerms } : {}),
          resolution: resolveExamFinding(action.display, action.searchTerms, options.examCatalogue ?? examCatalogue()),
        };
      }
      break;
    default:
      break;
  }

  return { ...base, kind: 'action', label: describeAction(action), secondary: actionSecondary(action) };
}

/** What a recommendation would put on the chart; two with the same key are one proposal. */
export function recommendationKey(rec: ScribeRecommendation): string {
  switch (rec.kind) {
    case 'template':
      return 'template';
    case 'hpi':
      return `note:${rec.field ?? HPI_FIELD}`;
    case 'vital-weight':
      // A recheck is another reading, as on the server; only the same reading twice is one proposal.
      return `vital:vital-weight:${rec.weightLbs}`;
    case 'allergy':
      return `allergy:${normalizeName(rec.name)}`;
    case 'medication':
      return `medication:${normalizeName(rec.name)}`;
    case 'diagnosis':
      return `diagnosis:${rec.code.toUpperCase()}`;
    case 'ros':
      // A symptom cannot be both reported and denied.
      return `ros:${rec.baseKey}`;
    case 'exam':
      return `exam:${rec.resolution.kind === 'confident' ? rec.resolution.leaf.field : normalizeName(rec.display)}`;
    case 'action': {
      const { kind, code, field, display, text } = rec.action;
      if (kind === 'set-vital') return `set-vital:${field}:${vitalReading(rec.action)}`;
      return `${kind}:${normalizeName(String(code ?? field ?? display ?? text ?? ''))}`;
    }
  }
}

/** The reading a guarded set-vital carries, in its canonical unit; the server keys repeats the same way. */
function vitalReading(action: PlannedAction): string {
  if (action.systolic != null && action.diastolic != null) return `${action.systolic}/${action.diastolic}`;
  if (action.value != null) return `${action.value}|${action.unit ?? ''}`;
  return normalizeName(action.display);
}

/** A readable, stable id such as `plan:add-diagnosis:J01-90`; a repeat gets a numeric suffix. */
function recommendationId(action: PlannedAction, taken: Set<string>): string {
  const identity = String(action.code ?? action.field ?? action.display ?? action.text ?? '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stem = ['plan', action.kind, identity].filter(Boolean).join(':');
  let id = stem;
  for (let n = 2; taken.has(id); n += 1) id = `${stem}:${n}`;
  taken.add(id);
  return id;
}

/**
 * The second hop of a quote's provenance: the generated lines its span overlaps in the narrative say
 * whether the words came from the transcript, from the generator alone, or from the provider.
 */
function transcriptProvenance(
  rec: ScribeRecommendation,
  narrative: string,
  located: LocatedLine[]
): { transcriptSources?: string[]; evidenceOrigin?: EvidenceOrigin } {
  if (!rec.evidence) return {};
  const at = locateQuote(narrative, rec.evidence);
  if (!at) return {};
  const overlapping = located.filter((line) => line.start < at.end && line.end > at.start);
  const transcriptSources = [...new Set(overlapping.flatMap((line) => line.original.sources))];
  if (transcriptSources.length > 0) return { transcriptSources, evidenceOrigin: 'backed' };
  if (overlapping.length === 0) return { transcriptSources, evidenceOrigin: 'provider' };
  const approximate = [...new Set(overlapping.flatMap((line) => line.original.approximateSource ?? []))];
  return approximate.length > 0
    ? { transcriptSources: approximate, evidenceOrigin: 'inexact' }
    : { transcriptSources, evidenceOrigin: 'unbacked' };
}

/** The plan's actions as one deduplicated list. Chat-only actions become notes; the server's refusals are carried through. */
export function buildAnalysis(plan: ChartPlanResponse, options: AnalysisContext): ScribeAnalysis {
  const ids = new Set<string>();
  const keys = new Set<string>();
  const recommendations: ScribeRecommendation[] = [];
  const notes: string[] = [];
  const rejected: RejectedAction[] = [...plan.rejected];

  const consider = (action: PlannedAction): void => {
    if (CHAT_ONLY.has(action.kind)) {
      const text = (action.text ?? action.message ?? '').trim();
      if (text && !notes.includes(text)) notes.push(text);
      return;
    }
    const candidate = toRecommendation(action, '', options);
    const key = recommendationKey(candidate);
    if (keys.has(key)) return;
    keys.add(key);
    recommendations.push({ ...candidate, id: recommendationId(action, ids) });
  };

  for (const action of plan.actions) consider(action);

  const { narrative, narrativeGenerated } = options;
  let traced = recommendations;
  if (narrative && narrativeGenerated) {
    const located = locateGeneratedLines(narrative, narrativeGenerated);
    traced = recommendations.map((rec) => ({ ...rec, ...transcriptProvenance(rec, narrative, located) }));
  }

  return {
    recommendations: traced,
    rejected,
    notes,
  };
}

/** The action the executor runs for a recommendation: the endpoint's action with the provider's edits over it. */
export function toPlannedAction(rec: ScribeRecommendation): PlannedAction {
  const original = rec.action;
  const base: PlannedAction = {
    ...(original ?? { kind: 'unknown' as ActionKind }),
    ...(rec.evidence ? { sourceText: rec.evidence } : {}),
  };
  // The model's synonyms describe its own wording; a renamed item searches on its new name alone.
  const { searchTerms: originalTerms, ...baseWithoutTerms } = base;
  const named = (display: string): PlannedAction =>
    original?.display === display && originalTerms
      ? { ...baseWithoutTerms, searchTerms: originalTerms }
      : baseWithoutTerms;

  switch (rec.kind) {
    case 'template':
      return {
        ...base,
        kind: 'apply-template',
        display: rec.templateName,
        ...(rec.templateId ? { templateId: rec.templateId } : {}),
      };
    case 'hpi':
      return { ...base, kind: 'edit-note-text', field: rec.field ?? HPI_FIELD, newText: rec.text };
    case 'allergy':
      return { ...named(rec.name), kind: 'add-allergy', display: rec.name };
    case 'medication':
      return {
        ...named(rec.name),
        kind: 'add-medication',
        display: rec.name,
        ...(rec.strength ? { strength: rec.strength } : {}),
        ...(rec.doseForm ? { doseForm: rec.doseForm } : {}),
      };
    case 'vital-weight':
      return {
        ...base,
        kind: 'set-vital',
        field: 'vital-weight',
        display: `${rec.weightLbs} lb`,
        value: rec.weightLbs,
        unit: 'lb',
      };
    case 'diagnosis':
      return {
        ...base,
        kind: 'add-diagnosis',
        code: rec.code,
        display: rec.display,
        isPrimary: rec.isPrimary === true,
      };
    case 'ros':
      // Only the polarity can have been edited; the original wording is kept for the lookup.
      return {
        ...base,
        kind: 'add-ros-finding',
        display: original?.display ?? `${rec.systemLabel}: ${rec.label}`,
        ...(original?.searchTerms ? { searchTerms: original.searchTerms } : {}),
        finding: rec.finding === RosFindingState.Denies ? 'denies' : 'reports',
      };
    case 'exam': {
      // The leaf the provider read or chose rides along, so the executor ticks that box.
      const leaf = resolvedExamLeaf(rec);
      const action: PlannedAction & ResolvedExamFindingAction = {
        ...baseWithoutTerms,
        kind: 'add-exam-finding',
        display: rec.display,
        ...(rec.searchTerms ? { searchTerms: rec.searchTerms } : {}),
        ...(leaf ? { resolvedLeaf: leaf } : {}),
      };
      return action;
    }
    case 'action':
      return rec.action;
  }
}

/**
 * A note paragraph is appended to what its field holds at write time (a template applied a moment earlier
 * may have written it); a `replace` row is the executor's plain rewrite.
 */
export function appendToNoteField(
  action: PlannedAction,
  rec: ScribeRecommendation,
  chart: ChartSnapshot,
  mode: NoteMode = 'append'
): PlannedAction {
  if (rec.kind !== 'hpi' || mode !== 'append' || action.kind !== 'edit-note-text') return action;
  const current = chart.noteFields[chartKeyForNoteField(rec.field ?? HPI_FIELD)]?.text?.trim();
  return current ? { ...action, newText: `${current}\n${action.newText}` } : action;
}
