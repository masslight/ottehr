import { ExamType } from '../../ottehr-config/examination';

export interface ApplyTemplateZambdaInput {
  encounterId: string;
  examType: ExamType;
  templateName: string;
}

export type ApplyTemplateZambdaOutput = void;
