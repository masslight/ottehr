import { ExamType } from '../../configuration';

export interface ListTemplatesZambdaInput {
  examType: ExamType;
}

export interface ListTemplatesZambdaOutput {
  templates: string[];
}
