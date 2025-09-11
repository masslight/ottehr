import { ExamType } from './examination/examination';

export interface ListTemplatesZambdaInput {
  examType: ExamType;
}

export interface ListTemplatesZambdaOutput {
  templates: string[];
}
