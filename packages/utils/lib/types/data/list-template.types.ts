export interface ListTemplatesZambdaInput {
  includeVersionData: boolean;
  /** Adds each template's diagnoses, for a caller that describes templates without applying one. */
  includeDiagnoses?: boolean;
}

export interface TemplateDiagnosis {
  /** ICD-10. */
  code: string;
  display: string;
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
  /** Primary first; set only when `includeDiagnoses` was asked for. */
  diagnoses?: TemplateDiagnosis[];
}

export interface ListTemplatesZambdaOutput {
  templates: TemplateInfo[];
}
