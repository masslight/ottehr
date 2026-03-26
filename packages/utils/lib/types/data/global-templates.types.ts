import { ExamType } from '../../ottehr-config/examination';

export interface ApplyTemplateInput {
  encounterId: string;
  examType: ExamType;
  templateName: string;
}
export type ApplyTemplateOutput = void;

export interface ListTemplateItem {
  id: string;
  name: string;
}
export interface ListTemplatesInput {
  examType: ExamType;
}
export interface ListTemplatesOutput {
  templates: ListTemplateItem[];
}

export interface ListAllTemplatesInput {
  examType?: ExamType;
}
export interface AdminListTemplateItem extends ListTemplateItem {
  versionStatus: 'current' | 'stale';
  examType: ExamType;
}
export interface ListAllTemplatesOutput {
  templates: AdminListTemplateItem[];
}

export interface CreateTemplateInput {
  encounterId: string;
  templateName: string;
  examType: ExamType;
}
export interface CreateTemplateOutput {
  templateId: string;
}

export interface RenameTemplateInput {
  templateId: string;
  newName: string;
}
export type RenameTemplateOutput = void;

export interface DeleteTemplateInput {
  templateId: string;
}
export type DeleteTemplateOutput = void;
