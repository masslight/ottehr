import { Questionnaire } from 'fhir/r4b';
import { PracticeManagedQuestionnaireGetOutput } from '../practice-managed-questionnaires/practice-managed-questionnaire.types';

// ============= get (unified detail endpoint) =============

// System-managed questionnaires carry logic the practice-managed parser cannot represent, so the detail
// endpoint returns the raw FHIR resource(s): the active version plus its draft (if one is saved).
export type SystemManagedQuestionnaireGetOutput = {
  isSystemManaged: true;
  questionnaire: Questionnaire;
  draft: Questionnaire | null;
};

// The detail (get) endpoint is tag-aware and returns a discriminated union.
export type ManagedQuestionnaireGetOutput =
  | ({ isSystemManaged: false } & PracticeManagedQuestionnaireGetOutput)
  | SystemManagedQuestionnaireGetOutput;

// ============= save draft =============

export type SaveSystemManagedDraftInput = {
  // full next-version FHIR Questionnaire (status: draft, bumped version, same url as the active form)
  questionnaire: Questionnaire;
};
export type SaveSystemManagedDraftOutput = {
  draftId: string;
};

// ============= clear draft =============

export type ClearSystemManagedDraftInput = {
  // canonical url of the form whose draft should be removed
  url: string;
};
export type ClearSystemManagedDraftOutput = {
  cleared: boolean;
};
