import { ExamType } from '../../ottehr-config';

export interface ListTemplatesZambdaInput {
  examType: ExamType;
  includeVersionData: boolean;
}

export type TemplateVersionData =
  | {
      isCurrentVersion: true;
    }
  | {
      isCurrentVersion: false;
      unmatchedFields: {
        ros: string[];
        exam: string[];
        legacyRosContained: boolean;
      };
    };
export interface TemplateInfo {
  id: string;
  title: string;
  examVersion: string;
  versionData?: TemplateVersionData;
}

export interface ListTemplatesZambdaOutput {
  templates: TemplateInfo[];
}
