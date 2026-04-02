import { ExamType } from '../../ottehr-config';

export interface ListTemplatesZambdaInput {
  examType: ExamType;
}

export interface TemplateInfo {
  id: string;
  title: string;
  examVersion: string;
  isCurrentVersion: boolean;
}

export interface ListTemplatesZambdaOutput {
  templates: TemplateInfo[];
}
