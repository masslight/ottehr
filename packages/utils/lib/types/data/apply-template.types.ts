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
  | 'emCode';

export type TemplateSectionActions = Partial<Record<TemplateSectionKey, TemplateSectionAction>>;

export const TEMPLATE_SECTION_DEFAULT_ACTIONS: Record<TemplateSectionKey, TemplateSectionAction> = {
  hpi: 'append',
  moi: 'append',
  ros: 'append',
  examFindings: 'overwrite',
  mdm: 'overwrite',
  diagnoses: 'append',
  patientInstructions: 'overwrite',
  cptCodes: 'append',
  emCode: 'overwrite',
};

export const TEMPLATE_SECTIONS_NO_APPEND: ReadonlySet<TemplateSectionKey> = new Set<TemplateSectionKey>([
  'examFindings',
  'emCode',
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
];

export interface ApplyTemplateZambdaInput {
  encounterId: string;
  templateName: string;
  sectionActions?: TemplateSectionActions;
}

export type ApplyTemplateZambdaOutput = void;
