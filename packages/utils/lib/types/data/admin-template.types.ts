import { RosFindingState } from 'utils';

// ── admin-create-template ──

export interface AdminCreateTemplateInput {
  encounterId: string;
  templateName: string;
}

export interface AdminCreateTemplateOutput {
  templateName: string;
  templateId: string;
}

// ── admin-rename-template ──

export interface AdminRenameTemplateInput {
  templateId: string;
  newName: string;
}

export interface AdminRenameTemplateOutput {
  message: string;
  templateId: string;
  newName: string;
}

// ── admin-delete-template ──

export interface AdminDeleteTemplateInput {
  templateId: string;
}

export interface AdminDeleteTemplateOutput {
  message: string;
}

// ── admin-get-template-detail ──

export interface AdminGetTemplateDetailInput {
  templateId: string;
}

export interface TemplateRosFinding {
  fieldName: string;
  label: string;
  findingState: RosFindingState | undefined;
  stale: boolean;
}
export interface TemplateExamFinding {
  fieldName: string;
  label: string;
  isAbnormal: boolean;
  note: string;
}

export interface TemplateCodeInfo {
  code: string;
  display: string;
}

export interface TemplateCptModifier {
  code: string;
  display: string;
}
export interface TemplateCptCodeInfo extends TemplateCodeInfo {
  modifiers: TemplateCptModifier[];
}

export function isTemplateCptCodeInfo(input: TemplateCodeInfo | TemplateCptCodeInfo): input is TemplateCptCodeInfo {
  return (input as TemplateCptCodeInfo).modifiers !== undefined;
}

export interface TemplateAccidentInfo {
  autoAccident: boolean;
  employment: boolean;
  otherAccident: boolean;
  date?: string;
  state?: string;
}

// Each in-house lab plan saved on a template carries the inputs the create-order
// flow needs at apply time: which test to order (referenced canonically by the
// ActivityDefinition so the live test definition is used), what to record as the
// reason for ordering, and any free-text notes the provider wrote when the
// template was saved.
//
// `missing: true` indicates the ActivityDefinition the plan references is not
// available on this environment - the admin UI can surface this so a human can
// fix the template; apply-template skips the plan with a warning.
//
// The test name, code, and cptCodes are all taken from the latest version of the ActivityDefinition, not stored on the plan
export interface TemplateInHouseLabPlanDetail {
  // ServiceRequest.id of the plan inside the template's contained resources.
  // Useful as a stable React key and for "remove this plan" admin flows.
  planId: string;
  testName: string;
  activityDefinitionRef: string;
  code: string;
  diagnoses: TemplateCodeInfo[];
  notes: string[];

  // CPT codes that will be materialized when this plan is applied, used by apply-template to
  // dedupe against the template's separate CPT Codes section.
  cptCodes: TemplateCptCodeInfo[];
  missing: boolean;
}

export interface AdminGetTemplateDetailOutput {
  templateName: string;
  templateId: string;
  examVersion: string;
  isCurrentVersion: boolean;
  sections: {
    hpiNote: string | null;
    moiNote: string | null;
    rosNote: string | null;
    rosFindings: TemplateRosFinding[];
    examFindings: TemplateExamFinding[];
    mdm: string | null;
    diagnoses: TemplateCodeInfo[];
    patientInstructions: { title: string | null; text: string }[];
    cptCodes: TemplateCptCodeInfo[];
    emCode: TemplateCodeInfo | null;
    accident: TemplateAccidentInfo | null;
    inHouseLabs: TemplateInHouseLabPlanDetail[];
  };
}
