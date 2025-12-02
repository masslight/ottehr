import { ExamType } from '../../configuration/examination';

export interface ApplyTemplateZambdaInput {
  encounterId: string;
  examType: ExamType;
  templateName: string;
}

export type ApplyTemplateZambdaOutput = void;
