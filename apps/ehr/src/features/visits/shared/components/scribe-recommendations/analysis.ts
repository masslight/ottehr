// From the endpoints' typed actions to the panel's recommendations, and back again.
//
// The plan and review endpoints return PlannedAction[] — the executor's input. The panel shows, edits and
// ticks recommendations. This module is the seam between the two: it turns each action into the
// recommendation kind the panel has an editor for (a diagnosis, an allergy, a weight, a review-of-systems
// finding, a note paragraph, a medication, a template), wraps everything else as a generic action row, and
// turns an edited recommendation back into the action the executor runs. Pure, so the seam is testable
// without a model, a network or a page.

import { describeAction } from 'src/features/easy-chart/executor/labels';
import { classifyMatches } from 'src/features/easy-chart/executor/resolve';
import { ActionKind, NoteTextField } from 'utils/lib/easy-chart/actions';
import { ChartPlanResponse, ChartReviewResponse, PlannedAction, RejectedAction } from 'utils/lib/easy-chart/api';
import { buildRosCatalogue, findRosMatches, RosCatalogueEntry } from 'utils/lib/easy-chart/matchers';
import { NOTE_FIELD_LABELS, overwritesWrittenNoteField } from 'utils/lib/easy-chart/note-fields';
import { findingPolarity } from 'utils/lib/easy-chart/provenance';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { buildTranscriptNarrative } from './transcriptNarrative';
import { RecommendationSource, ScribeAnalysis, ScribeRecommendation, ScribeSectionKey } from './types';

export interface AnalysisContext {
  /**
   * The free-text note fields as WRITTEN now, keyed by clinical name and carrying only non-empty fields —
   * exactly what `buildNoteContextFromChart` returns. A rewrite of one of these is the one recommendation
   * that starts unticked: it replaces prose the provider wrote.
   */
  written: Record<string, string | undefined>;
  /** Defaults to the ROS config's own catalogue; injectable for tests. */
  rosCatalogue?: RosCatalogueEntry[];
  /**
   * The transcript the actions were read from. When given, the analysis carries a narrative: the transcript
   * itself, with every recommendation's verbatim quote highlighted and linked to it.
   */
  transcript?: string;
}

/** Kinds that speak to the provider rather than to the chart. Never a recommendation: shown as a note. */
const CHAT_ONLY: ReadonlySet<string> = new Set<ActionKind>(['provider-note', 'reply', 'unknown']);

const HPI_FIELD: NoteTextField = 'historyOfPresentIllness';
export const INFERRED_NOTE = 'Inferred by the assistant — not quoted from the transcript.';
export const NEEDS_PROVIDER_WARNING = 'The assistant could not establish a value here; check it before applying.';

let defaultRosCatalogue: RosCatalogueEntry[] | undefined;
const rosCatalogue = (): RosCatalogueEntry[] => (defaultRosCatalogue ??= buildRosCatalogue());

/** The chart section an action writes into — which group the panel shows it in, and which page its rail opens. */
export function sectionForAction(action: PlannedAction): ScribeSectionKey {
  switch (action.kind) {
    case 'apply-template':
      return 'template';
    case 'edit-note-text':
      return action.field === 'ros' ? 'ros' : action.field === 'medicalDecision' ? 'assessment' : 'hpi';
    case 'set-vital':
      return 'vitals';
    case 'add-allergy':
    case 'remove-allergy':
      return 'allergies';
    case 'add-medication':
    case 'remove-medication':
      return 'medications';
    case 'add-condition':
    case 'remove-condition':
    case 'add-surgical-history':
    case 'remove-surgical-history':
    case 'add-hospitalization':
    case 'remove-hospitalization':
      return 'history';
    case 'add-exam-finding':
    case 'remove-exam-finding':
      return 'exam';
    case 'add-ros-finding':
    case 'remove-ros-finding':
      return 'ros';
    case 'add-diagnosis':
    case 'remove-diagnosis':
    case 'set-em-code':
    case 'remove-em-code':
    case 'add-cpt':
    case 'remove-cpt':
      return 'assessment';
    case 'set-disposition':
    case 'add-patient-instruction':
      return 'plan';
    case 'add-in-house-lab':
    case 'add-external-lab':
    case 'add-radiology':
    case 'add-nursing-order':
      return 'orders';
    case 'add-procedure':
    case 'update-procedure':
      return 'procedures';
    // Chat-only kinds never become recommendations, and a kind this build does not know is settled by the
    // executor with its own reason; either way the group is a formality.
    default:
      return 'plan';
  }
}

const joinWarnings = (...parts: (string | undefined)[]): string | undefined => {
  const all = parts.filter(Boolean);
  return all.length > 0 ? all.join(' ') : undefined;
};

/** The transcript quote, the guard's caution, and how the AI got here, as the row shows them on hover. */
function provenanceOf(
  action: PlannedAction,
  source: RecommendationSource
): { evidence?: string; warning?: string; note?: string } {
  const notes: string[] = [];
  if (source.pass === 'review') {
    notes.push(`Note review asked: ${source.question}${source.rationale ? ` ${source.rationale}` : ''}`);
  }
  // No verified quote means the model inferred it — the signal that tells a provider to look closely.
  if (!action.sourceText) notes.push(INFERRED_NOTE);
  return {
    evidence: action.sourceText,
    warning: joinWarnings(action.caution, action.needsProvider ? NEEDS_PROVIDER_WARNING : undefined),
    note: notes.length > 0 ? notes.join(' ') : undefined,
  };
}

function rosFindingOf(action: PlannedAction): RosFindingState {
  // The server's guard derives the polarity from the display verb when the model omitted it, so this is
  // normally set; the fallback reads the same verb the guard reads.
  if (action.finding === 'denies') return RosFindingState.Denies;
  if (action.finding === 'reports') return RosFindingState.Reports;
  return findingPolarity(action.display ?? '') === 'negated' ? RosFindingState.Denies : RosFindingState.Reports;
}

/**
 * The ROS entry an add-ros-finding resolves to, when it resolves to exactly one. The SAME matcher and the
 * same classification the executor applies at apply time, so a row shown as "Constitutional: Fever" is the
 * finding that gets charted; anything ambiguous stays a generic row and lets the executor decide, or ask.
 */
function resolveRosEntry(action: PlannedAction, catalogue: RosCatalogueEntry[]): RosCatalogueEntry | undefined {
  const matches = findRosMatches(action.display ?? '', catalogue, { searchTerms: action.searchTerms });
  const resolution = classifyMatches(matches);
  return resolution.kind === 'confident' ? (resolution.match.payload as RosCatalogueEntry) : undefined;
}

/** The second line of a generic row, for the kinds whose step label alone does not say what will be charted. */
export function actionSecondary(action: PlannedAction): string | undefined {
  switch (action.kind) {
    case 'set-disposition':
      return action.text;
    case 'set-em-code':
    case 'add-cpt':
      return action.display;
    default:
      return undefined;
  }
}

/** One action as the panel shows it. Typed where the panel has an editor for the kind, generic otherwise. */
function toRecommendation(
  action: PlannedAction,
  source: RecommendationSource,
  id: string,
  options: AnalysisContext
): ScribeRecommendation {
  const base = { id, section: sectionForAction(action), action, source, ...provenanceOf(action, source) };

  switch (action.kind) {
    case 'apply-template':
      if (action.display) {
        return { ...base, kind: 'template', templateName: action.display, templateId: action.templateId };
      }
      break;
    case 'edit-note-text': {
      const field = action.field as NoteTextField | undefined;
      if (field && field in NOTE_FIELD_LABELS && typeof action.newText === 'string') {
        // A rewrite of prose the provider already wrote is never applied unasked: it starts unticked and
        // says what it would replace. An edit to an EMPTY field has nothing to overwrite.
        const replaces = overwritesWrittenNoteField(action, options.written);
        return {
          ...base,
          kind: 'hpi',
          field,
          text: action.newText,
          ...(replaces
            ? {
                warning: joinWarnings(
                  base.warning,
                  `Replaces the ${NOTE_FIELD_LABELS[field]} text already in the note.`
                ),
                confirm: true,
              }
            : {}),
        };
      }
      break;
    }
    case 'set-vital':
      // The one vital with an editor of its own. The guard has already canonicalised the unit to lb or kg.
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
      // The server confirmed {code, display} against the terminology service from one row.
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
    default:
      break;
  }

  return { ...base, kind: 'action', label: describeAction(action), secondary: actionSecondary(action) };
}

const normalize = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

/**
 * What a recommendation would put on the chart, as a key. Two recommendations with the same key are the
 * same proposal — the model said it twice, or the review said what the plan already had — and only the
 * first is kept.
 */
export function recommendationKey(rec: ScribeRecommendation): string {
  switch (rec.kind) {
    case 'template':
      // One template per visit: a second suggestion is a second opinion on the same slot.
      return 'template';
    case 'hpi':
      return `note:${rec.field ?? HPI_FIELD}`;
    case 'vital-weight':
      return 'vital:vital-weight';
    case 'allergy':
      return `allergy:${normalize(rec.name)}`;
    case 'medication':
      return `medication:${normalize(rec.name)}`;
    case 'diagnosis':
      return `diagnosis:${rec.code.toUpperCase()}`;
    case 'ros':
      // One finding per symptom, whichever way it goes: the transcript cannot both report and deny it.
      return `ros:${rec.baseKey}`;
    case 'action': {
      const { kind, code, field, display, text } = rec.action;
      return `${kind}:${normalize(String(code ?? field ?? display ?? text ?? ''))}`;
    }
  }
}

/**
 * A readable, stable id: the pass, the action kind and what it names — `plan:add-diagnosis:J01-90`. It is
 * the row's test id and the key the narrative would link on, so it is made of the action rather than of a
 * counter. A second identical action gets a numeric suffix.
 */
function recommendationId(pass: RecommendationSource['pass'], action: PlannedAction, taken: Set<string>): string {
  const identity = String(action.code ?? action.field ?? action.display ?? action.text ?? '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stem = [pass, action.kind, identity].filter(Boolean).join(':');
  let id = stem;
  for (let n = 2; taken.has(id); n += 1) id = `${stem}:${n}`;
  taken.add(id);
  return id;
}

/**
 * The plan's actions, then the review's, as one list of recommendations. The review is a second look at
 * the same transcript, so whatever it repeats from the plan is dropped; what it adds carries its question.
 * Chat-only actions become notes, and the servers' refusals are carried through so nothing voiced
 * disappears silently.
 */
export function buildAnalysis(
  plan: ChartPlanResponse,
  review: ChartReviewResponse | undefined,
  options: AnalysisContext
): ScribeAnalysis {
  const ids = new Set<string>();
  const keys = new Set<string>();
  const recommendations: ScribeRecommendation[] = [];
  const notes: string[] = [];
  const rejected: RejectedAction[] = [...plan.rejected];

  const consider = (action: PlannedAction, source: RecommendationSource): void => {
    if (CHAT_ONLY.has(action.kind)) {
      const text = (action.text ?? action.message ?? '').trim();
      if (text && !notes.includes(text)) notes.push(text);
      return;
    }
    const candidate = toRecommendation(action, source, '', options);
    const key = recommendationKey(candidate);
    if (keys.has(key)) return;
    keys.add(key);
    recommendations.push({ ...candidate, id: recommendationId(source.pass, action, ids) } as ScribeRecommendation);
  };

  for (const action of plan.actions) consider(action, { pass: 'plan' });
  if (review) {
    for (const suggestion of review.suggestions) {
      const source: RecommendationSource = {
        pass: 'review',
        category: suggestion.category,
        question: suggestion.question,
        ...(suggestion.rationale ? { rationale: suggestion.rationale } : {}),
      };
      for (const action of suggestion.actions) consider(action, source);
    }
    rejected.push(...review.rejected);
  }

  return {
    narrative: options.transcript ? buildTranscriptNarrative(options.transcript, recommendations) : [],
    recommendations,
    orderSuggestions: [],
    rejected,
    notes,
  };
}

/**
 * The action the executor runs for a recommendation, as it stands now: the endpoint's own action with
 * whatever the provider edited laid over it. A recommendation built without an action (a fixture) gets one
 * made from its fields alone.
 */
export function toPlannedAction(rec: ScribeRecommendation): PlannedAction {
  const original = rec.action;
  const base: PlannedAction = {
    ...(original ?? { kind: 'unknown' as ActionKind }),
    ...(rec.evidence ? { sourceText: rec.evidence } : {}),
  };
  // Search terms describe what the model said; once the provider has renamed the item they may point at
  // a different product, so an edited name searches on its own.
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
      // Pounds on the wire, as the guard would have canonicalised them; the executor converts to kilograms.
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
      // The original wording resolved to this symptom with the same matcher the executor uses, so it is kept
      // for the lookup; only the polarity can have been edited, and it travels in `finding`.
      return {
        ...base,
        kind: 'add-ros-finding',
        display: original?.display ?? `${rec.systemLabel}: ${rec.label}`,
        ...(original?.searchTerms ? { searchTerms: original.searchTerms } : {}),
        finding: rec.finding === RosFindingState.Denies ? 'denies' : 'reports',
      };
    case 'action':
      return rec.action;
  }
}
