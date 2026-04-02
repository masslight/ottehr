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

export interface TemplateExamFinding {
  fieldName: string;
  label: string;
  isAbnormal: boolean;
  note: string;
}

export interface TemplateCodeInfo {
  code: string;
  display: string;
}

export interface TemplateAccidentInfo {
  autoAccident: boolean;
  employment: boolean;
  otherAccident: boolean;
  date?: string;
  state?: string;
}

export interface TemplateDetailOutput {
  templateName: string;
  templateId: string;
  examVersion: string;
  isCurrentVersion: boolean;
  sections: {
    hpiNote: string | null;
    moiNote: string | null;
    rosNote: string | null;
    examFindings: TemplateExamFinding[];
    mdm: string | null;
    diagnoses: TemplateCodeInfo[];
    patientInstructions: string | null;
    cptCodes: TemplateCodeInfo[];
    emCode: TemplateCodeInfo | null;
    accident: TemplateAccidentInfo | null;
  };
}
