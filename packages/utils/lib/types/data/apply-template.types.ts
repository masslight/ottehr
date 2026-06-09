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
  { key: 'procedures', label: 'Procedures' },
];
// In-house lab orders and in-office Procedures are additive only - replacing
// existing entries on an encounter is destructive (in-house labs may have
// specimens/results; procedures carry post-facto documentation a provider
// shouldn't lose by clicking the wrong toggle), so we constrain both sections
// to Skip or Append.
export const TEMPLATE_SECTIONS_NO_OVERWRITE: ReadonlySet<TemplateSectionKey> = new Set<TemplateSectionKey>([
  'inHouseLabs',
  'procedures',
]);

export interface ApplyTemplateZambdaInput {
  encounterId: string;
  templateName: string;
  sectionActions?: TemplateSectionActions;
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
