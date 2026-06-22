import { CreateLabPaymentMethod } from './labs/labs.types';

export type TemplateSectionAction = 'skip' | 'overwrite' | 'append';

export type TemplateSectionKey =
  | 'hpi'
  | 'moi'
  | 'ros'
  | 'examFindings'
  | 'mdm'
  | 'diagnoses'
  | 'patientInstructions'
  | 'cptCodes'
  | 'emCode'
  | 'inHouseLabs'
  | 'externalLabs'
  | 'procedures';

export type TemplateSectionActions = Partial<Record<TemplateSectionKey, TemplateSectionAction>>;

export const TEMPLATE_SECTION_DEFAULT_ACTIONS: Record<TemplateSectionKey, TemplateSectionAction> = {
  hpi: 'append',
  moi: 'append',
  ros: 'overwrite',
  examFindings: 'overwrite',
  mdm: 'overwrite',
  diagnoses: 'append',
  patientInstructions: 'overwrite',
  cptCodes: 'append',
  emCode: 'overwrite',
  inHouseLabs: 'append',
  externalLabs: 'append',
  procedures: 'append',
};

export const TEMPLATE_SECTIONS_NO_APPEND: ReadonlySet<TemplateSectionKey> = new Set<TemplateSectionKey>([
  'examFindings',
  'emCode',
  'ros',
]);

export interface TemplateSectionDescriptor {
  key: TemplateSectionKey;
  label: string;
}

export const TEMPLATE_SECTIONS_IN_ORDER: readonly TemplateSectionDescriptor[] = [
  { key: 'hpi', label: 'HPI (History of Present Illness)' },
  { key: 'moi', label: 'MOI (Mechanism of Injury)' },
  { key: 'ros', label: 'Review of Systems (ROS)' },
  { key: 'examFindings', label: 'Exam Findings' },
  { key: 'mdm', label: 'Medical Decision Making (MDM)' },
  { key: 'diagnoses', label: 'Assessment / ICD-10 Diagnoses' },
  { key: 'patientInstructions', label: 'Patient Instructions' },
  { key: 'cptCodes', label: 'CPT Codes' },
  { key: 'emCode', label: 'E&M Code' },
  { key: 'inHouseLabs', label: 'In-House Lab Orders' },
  { key: 'externalLabs', label: 'External Lab Orders' },
  { key: 'procedures', label: 'Procedures' },
];
// Lab orders (in-house and external) and in-office Procedures are additive
// only - replacing existing entries on an encounter is destructive (lab orders
// may have specimens/results; procedures carry post-facto documentation a
// provider shouldn't lose by clicking the wrong toggle), so we constrain these
// sections to Skip or Append.
export const TEMPLATE_SECTIONS_NO_OVERWRITE: ReadonlySet<TemplateSectionKey> = new Set<TemplateSectionKey>([
  'inHouseLabs',
  'externalLabs',
  'procedures',
]);

// Extra inputs collected by the preview dialog beyond the per-section actions.
// External lab orders require a payment method at create time, so when the
// External Lab Orders section is appended the user's confirmed selection rides
// along with the apply call.
interface ExternalLabsInTemplate {
  paymentMethod: CreateLabPaymentMethod;
}

export interface TemplatePreviewApplyOptions {
  externalLabs?: ExternalLabsInTemplate;
}

export interface ApplyTemplateZambdaInput {
  encounterId: string;
  templateName: string;
  sectionActions?: TemplateSectionActions;
  // External lab orders require a payment method at create time, and templates
  // don't carry one (it's visit-specific). The preview dialog defaults a
  // selection from the visit's payment details and requires the user to
  // confirm it before appending the External Lab Orders section; it's passed
  // here and used for every external lab plan on the template. When omitted,
  // the section is skipped with a warning.
  externalLabs?: ExternalLabsInTemplate;
}

export interface ApplyTemplateWarning {
  section: TemplateSectionKey;
  message: string;
}

// Apply-template now returns soft warnings so the EHR can surface non-fatal issues
// (e.g. an in-house lab plan whose ActivityDefinition no longer exists in this
// environment was skipped) without blocking the rest of the template from applying.
export interface ApplyTemplateZambdaOutput {
  warnings?: ApplyTemplateWarning[];
}
