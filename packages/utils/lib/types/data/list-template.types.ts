import { ExamType } from '../../ottehr-config';

export interface ListTemplatesZambdaInput {
  examType: ExamType;
}

export interface ListTemplatesZambdaOutput {
  templates: string[];
}
