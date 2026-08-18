// The closed vocabulary of things the Easy Chart assistant can do.
//
// THE architectural rule this file serves (see docs/easy-chart-rebuild-plan.md, Phase 0): the LLM
// never writes. It returns a list of typed actions drawn from this vocabulary, and deterministic,
// unit-tested code resolves each one against a catalogue and writes it through the pre-existing
// chart endpoints. Every model mistake is therefore a *wrong action* — validatable, gateable, and
// showable to the provider — rather than a wrong database row.
//
// Two shapes live here and they are deliberately different:
//   - `RawAction` is the FLAT shape the model emits and the response schema declares. Every field
//     except `kind` is optional. See the registry's schema module for why it is flat rather than a
//     discriminated `anyOf`.
//   - `Action` is the discriminated union the executor consumes, so a handler for `set-vital` can
//     rely on `field` being present. `hasRequiredFields()` in the registry is the runtime gate that
//     turns the former into the latter.
//
// ACTION_KINDS and Action['kind'] are proven to be the same set by two type assertions in
// registry.ts. Adding a kind to one without the other is a build error, not a silent no-op.

import { DispositionType } from '../types/api/chart-data/chart-data.types';

/**
 * Where an action may be offered. The planner charts a visit; the review pass corrects a note it
 * did not write, and is deliberately offered a much narrower vocabulary.
 */
export const SURFACES = ['plan', 'review'] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * Every property an action may carry, across all kinds. The response schema for a surface is
 * generated from the union of the fields its capabilities declare, so this list and the schema
 * cannot drift.
 */
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
  'value',
  'unit',
  'systolic',
  'diastolic',
  'strength',
  'doseForm',
  'dispositionType',
  'followUpInDays',
  'procedureMatch',
  'updates',
  'message',
  'sourceText',
] as const;
export type ActionField = (typeof ACTION_FIELDS)[number];

export const ACTION_KINDS = [
  'apply-template',
  'add-allergy',
  'remove-allergy',
  'add-condition',
  'remove-condition',
  'add-medication',
  'remove-medication',
  'add-surgical-history',
  'remove-surgical-history',
  'add-hospitalization',
  'remove-hospitalization',
  'edit-note-text',
  'set-vital',
  'add-exam-finding',
  'remove-exam-finding',
  'add-ros-finding',
  'remove-ros-finding',
  'add-diagnosis',
  'remove-diagnosis',
  'add-in-house-lab',
  'add-external-lab',
  'add-radiology',
  'add-procedure',
  'update-procedure',
  'set-em-code',
  'remove-em-code',
  'add-cpt',
  'remove-cpt',
  'set-disposition',
  'add-patient-instruction',
  'add-nursing-order',
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

/**
 * The vitals `set-vital` may target. A subset of VitalFieldNames: BMI is derived, and vision and
 * LMP are not dictated in the narratives this feature reads.
 */
export const PLANNABLE_VITAL_FIELDS = [
  'vital-temperature',
  'vital-heartbeat',
  'vital-respiration-rate',
  'vital-oxygen-sat',
  'vital-blood-pressure',
  'vital-weight',
  'vital-height',
] as const;
export type PlannableVitalField = (typeof PLANNABLE_VITAL_FIELDS)[number];

/** The dispositions the assistant may set. A subset of DispositionType; the rest are workflow-only. */
export const PLANNABLE_DISPOSITION_TYPES = ['pcp', 'specialty', 'ed', 'another', 'ip'] as const;
export type PlannableDispositionType = (typeof PLANNABLE_DISPOSITION_TYPES)[number];

// Compile-time proof that the plannable subset really is a subset of the chart's own type. Widening
// DispositionType is fine; renaming one of these out from under us is not.
const _DISPOSITION_SUBSET_CHECK: readonly DispositionType[] = PLANNABLE_DISPOSITION_TYPES;
void _DISPOSITION_SUBSET_CHECK;

/** The fields `update-procedure` may set. Mirrors the procedure form. */
export const PROCEDURE_UPDATE_FIELDS = [
  'bodySite',
  'bodySide',
  'technique',
  'suppliesUsed',
  'procedureDetails',
  'medicationUsed',
  'complications',
  'patientResponse',
  'postInstructions',
  'timeSpent',
  'performerType',
  'documentedBy',
  'specimenSent',
  'consentObtained',
] as const;
export type ProcedureUpdateField = (typeof PROCEDURE_UPDATE_FIELDS)[number];

export interface ProcedureUpdate {
  field: string;
  value: string;
}

/**
 * Provenance, carried on every action the model returns.
 *
 * `sourceText` is the VERBATIM phrase from the narrative that justifies the action. It is verified
 * server-side against the narrative and dropped if it isn't really there — models paraphrase and
 * stitch list items together, and a fabricated citation in a medical record is worse than none.
 * An action with no `sourceText` is honestly marked *inferred* in the UI, which is the signal that
 * tells a provider to look closely.
 */
export interface ActionProvenance {
  sourceText?: string;
  /** Set by a server guard when the value was accepted but is questionable (see Phase 4.4). */
  caution?: string;
  /** True when the value could not be established and the provider must supply it. */
  needsProvider?: boolean;
}

/** The flat shape the model emits and the response schema declares. */
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
  procedureMatch?: string;
  updates?: ProcedureUpdate[];
  message?: string;
}

/** A catalogue lookup: what the provider said, plus synonyms to search a clinical database with. */
export interface SearchableAction extends ActionProvenance {
  display: string;
  searchTerms?: string[];
}

export type Action = ActionProvenance &
  (
    | ({ kind: 'apply-template' } & SearchableAction)
    | ({ kind: 'add-allergy' } & SearchableAction)
    | ({ kind: 'remove-allergy' } & SearchableAction)
    | ({ kind: 'add-condition'; code?: string } & SearchableAction)
    | ({ kind: 'remove-condition' } & SearchableAction)
    | ({ kind: 'add-medication'; strength?: string; doseForm?: string } & SearchableAction)
    | ({ kind: 'remove-medication' } & SearchableAction)
    | ({ kind: 'add-surgical-history' } & SearchableAction)
    | ({ kind: 'remove-surgical-history' } & SearchableAction)
    | ({ kind: 'add-hospitalization' } & SearchableAction)
    | ({ kind: 'remove-hospitalization' } & SearchableAction)
    | { kind: 'edit-note-text'; field: NoteTextField; newText: string }
    | {
        kind: 'set-vital';
        field: PlannableVitalField;
        display: string;
        /** Populated server-side by the unit canonicaliser; never trusted from the model. */
        value?: number;
        unit?: string;
        systolic?: number;
        diastolic?: number;
      }
    | ({ kind: 'add-exam-finding' } & SearchableAction)
    | ({ kind: 'remove-exam-finding' } & SearchableAction)
    | ({ kind: 'add-ros-finding'; finding?: string } & SearchableAction)
    | ({ kind: 'remove-ros-finding'; finding?: string } & SearchableAction)
    | ({ kind: 'add-diagnosis'; code?: string; isPrimary?: boolean } & SearchableAction)
    | ({ kind: 'remove-diagnosis' } & SearchableAction)
    | ({ kind: 'add-in-house-lab' } & SearchableAction)
    | ({ kind: 'add-external-lab' } & SearchableAction)
    | ({ kind: 'add-radiology' } & SearchableAction)
    | ({ kind: 'add-procedure' } & SearchableAction)
    | { kind: 'update-procedure'; updates: ProcedureUpdate[]; procedureMatch?: string }
    | { kind: 'set-em-code'; code: string; display?: string }
    | { kind: 'remove-em-code'; code?: string }
    | { kind: 'add-cpt'; code: string; display?: string }
    | { kind: 'remove-cpt'; code: string }
    | {
        kind: 'set-disposition';
        dispositionType: PlannableDispositionType;
        text: string;
        followUpInDays?: number;
      }
    | { kind: 'add-patient-instruction'; text: string }
    | { kind: 'add-nursing-order'; text: string }
    | { kind: 'provider-note'; text: string }
    | { kind: 'reply'; text: string }
    | { kind: 'unknown'; message?: string }
  );

/** Narrowing helper for the dispatch table. */
export type ActionOfKind<K extends ActionKind> = Extract<Action, { kind: K }>;
