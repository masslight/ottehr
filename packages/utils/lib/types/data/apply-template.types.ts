import { ExamType } from './examination/examination';

export interface ApplyTemplateZambdaInput {
  examType: ExamType;
  templateName: string;
}

export type ApplyTemplateZambdaOutput = void;
