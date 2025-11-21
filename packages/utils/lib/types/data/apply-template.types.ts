import { ExamType } from './examination/examination';

export interface ApplyTemplateZambdaInput {
  encounterId: string;
  examType: ExamType;
  templateName: string;
}

export type ApplyTemplateZambdaOutput = void;
