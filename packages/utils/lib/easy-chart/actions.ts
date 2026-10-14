// The closed vocabulary of Easy Chart actions. The model never writes to the chart: it returns typed
// actions, and deterministic code validates them and writes them through the regular chart endpoints.
//
// `RawAction` is the flat shape the model emits; `Action` is the discriminated union the executor runs.
// The server checks every action against its registry shape before the client sees it.

import { VitalFieldNames } from '../types/api/chart-data/chart-data.constants';
import { DispositionType, followUpInOptions } from '../types/api/chart-data/chart-data.types';

/** Every property an action may carry on the wire, in the order the response schema lists them. */
export const ACTION_FIELDS = [
  'kind',
  'display',
  'searchTerms',
  'code',
  'isPrimary',
  'field',
  'newText',
  'text',
  'finding',
  'strength',
  'doseForm',
  'dispositionType',
  'followUpInDays',
  'message',
  'sourceText',
] as const;
export type ActionField = (typeof ACTION_FIELDS)[number];

export const ACTION_KINDS = [
  'apply-template',
  'add-allergy',
  'add-condition',
  'add-medication',
  'add-surgical-history',
  'add-hospitalization',
  'edit-note-text',
  'set-vital',
  'add-exam-finding',
  'add-ros-finding',
  'add-diagnosis',
  'set-em-code',
  'set-disposition',
  'add-patient-instruction',
  'provider-note',
  'reply',
  'unknown',
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

/** The free-text note fields `edit-note-text` may target. */
export const NOTE_TEXT_FIELDS = [
  'chiefComplaint',
  'historyOfPresentIllness',
  'mechanismOfInjury',
  'ros',
  'medicalDecision',
] as const;
export type NoteTextField = (typeof NOTE_TEXT_FIELDS)[number];

/** The save-chart-data vitals `set-vital` may target: BMI is derived, and vision and LMP are not dictated. */
export const PLANNABLE_VITAL_FIELDS = [
  'vital-temperature',
  'vital-heartbeat',
  'vital-respiration-rate',
  'vital-oxygen-sat',
  'vital-blood-pressure',
  'vital-weight',
  'vital-height',
] as const satisfies readonly `${VitalFieldNames}`[];
export type PlannableVitalField = (typeof PLANNABLE_VITAL_FIELDS)[number];

/**
 * The dispositions the assistant may set: the tabs of the in-person Disposition card, a subset of the
 * save-chart-data `DispositionType`.
 */
export const PLANNABLE_DISPOSITION_TYPES = [
  'pcp-no-type',
  'specialty',
  'ed',
  'another',
] as const satisfies readonly DispositionType[];
export type PlannableDispositionType = (typeof PLANNABLE_DISPOSITION_TYPES)[number];

export const isPlannableDispositionType = (value: unknown): value is PlannableDispositionType =>
  typeof value === 'string' && (PLANNABLE_DISPOSITION_TYPES as readonly string[]).includes(value);

/** The types whose card has a follow-up interval, and the intervals its select offers (0 is "as needed"). */
const FOLLOW_UP_DISPOSITION_TYPES: readonly PlannableDispositionType[] = ['pcp-no-type', 'specialty'];
export const FOLLOW_UP_DAYS: readonly number[] = followUpInOptions.map((option) => option.value);

/** The follow-up interval the Disposition card can show for this type, or undefined when it has none. */
export function chartableFollowUpDays(type: unknown, days: unknown): number | undefined {
  const typed = isPlannableDispositionType(type) && FOLLOW_UP_DISPOSITION_TYPES.includes(type);
  return typed && typeof days === 'number' && FOLLOW_UP_DAYS.includes(days) ? days : undefined;
}

interface ActionProvenance {
  /** The verbatim narrative phrase behind the action. The server drops it unless it really occurs there. */
  sourceText?: string;
  /** Set by a server guard when the value was accepted but deserves a second look. */
  caution?: string;
}

/** The flat shape the model emits. Numeric fields are filled in by server guards, never by the model. */
export interface RawAction extends ActionProvenance {
  kind: ActionKind;
  display?: string;
  searchTerms?: string[];
  code?: string;
  isPrimary?: boolean;
  field?: string;
  newText?: string;
  text?: string;
  finding?: string;
  value?: number | string;
  unit?: string;
  systolic?: number | string;
  diastolic?: number | string;
  strength?: string;
  doseForm?: string;
  dispositionType?: string;
  followUpInDays?: number | string;
  message?: string;
}

interface SearchableAction extends ActionProvenance {
  display: string;
  searchTerms?: string[];
}

export type Action = ActionProvenance &
  (
    | ({ kind: 'apply-template'; templateId?: string } & SearchableAction)
    | ({ kind: 'add-allergy' } & SearchableAction)
    | ({ kind: 'add-condition'; code?: string } & SearchableAction)
    | ({ kind: 'add-medication'; strength?: string; doseForm?: string } & SearchableAction)
    | ({ kind: 'add-surgical-history' } & SearchableAction)
    | ({ kind: 'add-hospitalization' } & SearchableAction)
    | { kind: 'edit-note-text'; field: NoteTextField; newText: string }
    | {
        kind: 'set-vital';
        field: PlannableVitalField;
        display: string;
        /** Parsed from `display` by the server; never trusted from the model. */
        value?: number;
        unit?: string;
        systolic?: number;
        diastolic?: number;
      }
    | ({ kind: 'add-exam-finding' } & SearchableAction)
    | ({ kind: 'add-ros-finding'; finding?: string } & SearchableAction)
    | ({ kind: 'add-diagnosis'; code?: string; isPrimary?: boolean } & SearchableAction)
    | { kind: 'set-em-code'; code: string; display?: string }
    | {
        kind: 'set-disposition';
        dispositionType: PlannableDispositionType;
        text: string;
        followUpInDays?: number;
      }
    | { kind: 'add-patient-instruction'; text: string }
    | { kind: 'provider-note'; text: string }
    | { kind: 'reply'; text: string }
    | { kind: 'unknown'; message?: string }
  );

export type ActionOfKind<K extends ActionKind> = Extract<Action, { kind: K }>;
