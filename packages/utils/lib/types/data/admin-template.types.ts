import { ExamType } from '../../ottehr-config';

// ── admin-create-template ──

export interface AdminCreateTemplateInput {
  encounterId: string;
  templateName: string;
  examType: ExamType;
}

export interface AdminCreateTemplateOutput {
  templateName: string;
  templateId: string;
}

// ── admin-rename-template ──

export interface AdminRenameTemplateInput {
  templateId: string;
  newName: string;
}

export interface AdminRenameTemplateOutput {
  message: string;
  templateId: string;
  newName: string;
}

// ── admin-delete-template ──

export interface AdminDeleteTemplateInput {
  templateId: string;
}

export interface AdminDeleteTemplateOutput {
  message: string;
}

// ── admin-get-template-detail ──

export interface AdminGetTemplateDetailInput {
  templateId: string;
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

export interface AdminGetTemplateDetailOutput {
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
    patientInstructions: { title: string | null; text: string }[];
    cptCodes: TemplateCodeInfo[];
    emCode: TemplateCodeInfo | null;
    accident: TemplateAccidentInfo | null;
  };
}
