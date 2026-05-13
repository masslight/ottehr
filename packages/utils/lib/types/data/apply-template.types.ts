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
  | 'accident';

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
};

export const TEMPLATE_SECTIONS_NO_APPEND: ReadonlySet<TemplateSectionKey> = new Set<TemplateSectionKey>([
  'examFindings',
  'emCode',
  'accident',
]);

export interface ApplyTemplateZambdaInput {
  encounterId: string;
  examType: ExamType;
  templateName: string;
  sectionActions?: TemplateSectionActions;
}

export type ApplyTemplateZambdaOutput = void;
