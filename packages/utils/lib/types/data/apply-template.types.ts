import { ExamType } from '../../ottehr-config/examination';

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
  | 'accident'
  | 'inHouseLabs';

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
  accident: 'overwrite',
  inHouseLabs: 'append',
};

export const TEMPLATE_SECTIONS_NO_APPEND: ReadonlySet<TemplateSectionKey> = new Set<TemplateSectionKey>([
  'examFindings',
  'emCode',
  'accident',
]);

// In-house lab orders are additive only - replacing existing in-flight orders on
// an encounter doesn't make sense (specimens, tasks, and results that may already
// exist for those orders shouldn't be silently destroyed), so we constrain the
// section to Skip or Append.
export const TEMPLATE_SECTIONS_NO_OVERWRITE: ReadonlySet<TemplateSectionKey> = new Set<TemplateSectionKey>([
  'inHouseLabs',
]);

export interface ApplyTemplateZambdaInput {
  encounterId: string;
  examType: ExamType;
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
