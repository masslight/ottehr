import { RosFindingState, TemplateWarning } from 'utils';

// ── admin-create-template ──

export interface AdminCreateTemplateInput {
  encounterId: string;
  templateName: string;
}

export interface AdminCreateTemplateOutput {
  templateName: string;
  templateId: string;
  warnings: TemplateWarning[];
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

// Each external lab plan saved on a template carries the inputs the external
// create-lab-order flow needs at apply time: the lab + test combo (lab GUID,
// lab name, and the orderable item code), the Dx reason codes, the optional
// clinical info note, and the PSC flag. The ordering office and payment
// method are NOT stored - both are visit-specific: the office is derived from
// the encounter the template is applied to, and the payment method defaults
// from that visit's payment details in the preview dialog.
//
// `missing: true` indicates the test could not be found in the lab's current
// compendium via the orderable item search - the admin UI surfaces this so a
// human can fix the template; apply-template skips the plan with a warning.
export interface TemplateExternalLabPlanDetail {
  // ServiceRequest.id of the plan inside the template's contained resources.
  planId: string;
  labGuid: string;
  labName: string;
  testName: string;
  testCode: string;
  diagnoses: TemplateCodeInfo[];
  note: string | null;
  psc: boolean;
  missing: boolean;
}

// Each in-office procedure plan saved on a template captures everything the
// chart UI's procedure form exposes - the procedure type, body site/side,
// performer, technique, and the rest of the form's checkbox/dropdown answers -
// plus the diagnosis and CPT-code links the original procedure carried, so a
// provider applying the template gets the same documentation skeleton they
// would by recreating the procedure by hand.
//
// Diagnosis and CPT links are resolved into inline {code, display} tuples here
// so the UI can show "J02.9 - Acute pharyngitis" without having to follow
// references into the template's other contained resources.
export interface TemplateProcedurePlan {
  planId: string;
  procedureType: string | undefined;
  performerType: string | undefined;
  bodySite: string | undefined;
  bodySide: string | undefined;
  technique: string[];
  medicationUsed: string | undefined;
  suppliesUsed: string | undefined;
  procedureDetails: string | undefined;
  specimenSent: boolean | undefined;
  complications: string | undefined;
  patientResponse: string | undefined;
  postInstructions: string | undefined;
  timeSpent: string | undefined;
  documentedBy: string | undefined;
  consentObtained: boolean | undefined;
  diagnoses: TemplateCodeInfo[];
  // Carries modifiers alongside the code/display so CPTs with attached modifiers
  // (e.g. "29105-LT") render the same in the procedure card as in the standalone
  // CPT Codes section. The shared CodeList component already handles both
  // TemplateCodeInfo and TemplateCptCodeInfo via isTemplateCptCodeInfo.
  cptCodes: TemplateCptCodeInfo[];
}

// Each in-house medication plan saved on a template carries the inputs needed
// to recreate the order at apply time: the drug identity (as a CodeableConcept),
// the dosage (amount, units, route, site), instructions, free-text notes
// (reason / other reason), any CPT/HCPCS codes, and the ICD-10 diagnoses
// that were associated with the original order.
// Patient-specific fields (performer, effectiveDateTime, associated Dx Condition)
// are NOT stored on the plan — they're visit-specific.
export interface TemplateInHouseMedicationDetail {
  planId: string;
  medicationName: string;
  dose: number | undefined;
  units: string | undefined;
  route: string | undefined;
  instructions: string | undefined;
  cptCodes: TemplateCptCodeInfo[];
  diagnoses: TemplateCodeInfo[];
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
    externalLabs: TemplateExternalLabPlanDetail[];
    procedures: TemplateProcedurePlan[];
    inHouseMedications: TemplateInHouseMedicationDetail[];
  };
}
