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
import { ChartSnapshot } from 'src/features/easy-chart/executor/types';
import { ActionKind, NoteTextField } from 'utils/lib/easy-chart/actions';
import {
  ChartPlanResponse,
  ChartReviewResponse,
  NarrativeLine,
  PlannedAction,
  RejectedAction,
} from 'utils/lib/easy-chart/api';
import { buildRosCatalogue, findRosMatches, RosCatalogueEntry } from 'utils/lib/easy-chart/matchers';
import { chartKeyForNoteField, NOTE_FIELD_LABELS, overwritesWrittenNoteField } from 'utils/lib/easy-chart/note-fields';
import { findingPolarity, locateQuote } from 'utils/lib/easy-chart/provenance';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { locateGeneratedLines } from './narrativeLines';
import { buildNarrativeRuns } from './narrativeRuns';
import {
  EvidenceOrigin,
  LocatedLine,
  RecommendationSource,
  ScribeAnalysis,
  ScribeRecommendation,
  ScribeSectionKey,
} from './types';

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
   * The narrative the actions were read from — the text the planner was sent, so the text its quotes were
   * verified against. When given, the analysis carries the runs: the narrative itself, cut so that every
   * recommendation's verbatim quote is highlighted and linked to it.
   */
  narrative?: string;
  /**
   * The narrative as the generator wrote it, before the provider edited it, for the second hop of the
   * provenance: the generated sentence a quote sits in says which transcript snippets back it, or that
   * nothing does; a quote in no generated sentence is in something the provider wrote.
   */
  narrativeGenerated?: NarrativeLine[];
  /**
   * True when the planner was sent the TRANSCRIPT as its narrative, with the provider's edited narrative
   * along only as corrections. A quote verified against the planner's narrative is then a transcript
   * snippet, not a phrase of the narrative box, and is shown as such rather than highlighted.
   */
  narrativeIsTranscript?: boolean;
}

/** Kinds that speak to the provider rather than to the chart. Never a recommendation: shown as a note. */

const CHAT_ONLY: ReadonlySet<string> = new Set<ActionKind>(['provider-note', 'reply', 'unknown']);

const HPI_FIELD: NoteTextField = 'historyOfPresentIllness';
export const INFERRED_NOTE = 'Inferred by the assistant — not quoted from the narrative.';
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

/** The narrative quote, the guard's caution, and how the AI got here, as the row shows them on hover. */
function provenanceOf(
  action: PlannedAction,
  source: RecommendationSource,
  narrativeIsTranscript: boolean
): {
  evidence?: string;
  warning?: string;
  note?: string;
  transcriptSources?: string[];
  evidenceOrigin?: EvidenceOrigin;
} {
  const notes: string[] = [];
  if (source.pass === 'review') {
    notes.push(`Note review asked: ${source.question}${source.rationale ? ` ${source.rationale}` : ''}`);
  }
  const { sourceText } = action;
  // No verified quote at all means the model inferred it — the signal that tells a provider to look closely.
  if (!sourceText) notes.push(INFERRED_NOTE);
  // A quote verified against the provider's edited narrative is a phrase of the narrative box, highlighted
  // there and traced a hop further by `transcriptProvenance`. One verified against the planner's `narrative`
  // is the same when that narrative was typed by hand, but when it was the transcript the quote is the
  // transcript's own words: shown as a snippet, and no narrative run is cut for it. Absent origin is an
  // older server, which only ever verified against the narrative.
  const quotesTranscript = narrativeIsTranscript && action.sourceOrigin !== 'edited-narrative';
  return {
    ...(sourceText && quotesTranscript
      ? { transcriptSources: [sourceText], evidenceOrigin: 'transcript' as const }
      : { evidence: sourceText }),
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
  const base = {
    id,
    section: sectionForAction(action),
    action,
    source,
    ...provenanceOf(action, source, options.narrativeIsTranscript === true),
  };

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
 * The second hop of a recommendation's provenance: its quote is located in the narrative, and the generated
 * sentence(s) that stretch of text overlaps say where the words came from. A quote can straddle two
 * sentences, so the sources of every one it touches are pooled: any source at all and the evidence is
 * backed; a sentence but no source and the generator said it on its own; no sentence at all and the quote
 * is in text the provider wrote or changed. Nothing is set for an inferred recommendation (no quote), a
 * quote taken from the transcript rather than the narrative (no `evidence`; already traced), or a quote
 * the narrative cannot be found to contain.
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
  const evidenceOrigin: EvidenceOrigin =
    transcriptSources.length > 0 ? 'backed' : overlapping.length > 0 ? 'unbacked' : 'provider';
  return { transcriptSources, evidenceOrigin };
}

/**
 * The plan's actions, then the review's, as one list of recommendations. The review is a second look at
 * the same narrative, so whatever it repeats from the plan is dropped; what it adds carries its question.
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

  const { narrative, narrativeGenerated } = options;
  let traced = recommendations;
  if (narrative && narrativeGenerated) {
    // Found in the same string the quotes are located in, so the two sets of offsets agree.
    const located = locateGeneratedLines(narrative, narrativeGenerated);
    traced = recommendations.map((rec) => ({ ...rec, ...transcriptProvenance(rec, narrative, located) }));
  }

  return {
    narrativeRuns: narrative ? buildNarrativeRuns(narrative, traced) : [],
    recommendations: traced,
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

/**
 * The scribe ADDS to a note paragraph: its text goes after whatever the field already says, unless the row
 * is an explicit rewrite (`confirm`), which replaces it. The executor's own `edit-note-text` rewrites, so
 * the appending is done here, on the scribe's path only, and read off the chart as it stands at write
 * time — the template the Chart button applies a moment earlier has usually written the field since the
 * analysis ran.
 */
export function appendToNoteField(
  action: PlannedAction,
  rec: ScribeRecommendation,
  chart: ChartSnapshot
): PlannedAction {
  if (rec.kind !== 'hpi' || rec.confirm || action.kind !== 'edit-note-text') return action;
  const current = chart.noteFields[chartKeyForNoteField(rec.field ?? HPI_FIELD)]?.text?.trim();
  return current ? { ...action, newText: `${current}\n${action.newText}` } : action;
}
