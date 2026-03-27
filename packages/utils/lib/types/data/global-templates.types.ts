import { z } from 'zod';
import { ExamType } from '../../ottehr-config/examination';
import { Secrets } from '../../secrets';

// apply template
export const ApplyTemplateInputSchema = z.object({
  encounterId: z.string().uuid(),
  examType: z.nativeEnum(ExamType),
  templateName: z.string(),
});
export type ApplyTemplateInput = z.infer<typeof ApplyTemplateInputSchema>;
export type ApplyTemplateOutput = void;

// list templates
export interface ListTemplateItem {
  id: string;
  name: string;
}
export const ListTemplatesInputSchema = z.object({
  examType: z.nativeEnum(ExamType),
});
export type ListTemplatesInput = z.infer<typeof ListTemplatesInputSchema>;
export interface ListTemplatesOutput {
  templates: ListTemplateItem[];
}

// list all templates
export const ListAllTemplatesInputSchema = z.object({
  filter: z.string().optional(),
});
export type ListAllTemplatesInput = z.infer<typeof ListAllTemplatesInputSchema>;
export const ListAllTemplatesInputValidatedSchema = ListAllTemplatesInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});
export type ListAllTemplatesInputValidated = z.infer<typeof ListAllTemplatesInputValidatedSchema>;
export interface AdminListTemplateItem extends ListTemplateItem {
  versionStatus: 'current' | 'stale';
  examType: ExamType;
}
export interface ListAllTemplatesOutput {
  templates: AdminListTemplateItem[];
}

// create template
export const CreateTemplateInputSchema = z.object({
  encounterId: z.string().uuid(),
  templateName: z.string(),
  examType: z.nativeEnum(ExamType),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>;
export const CreateTemplateInputValidatedSchema = CreateTemplateInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});
export type CreateTemplateInputValidated = z.infer<typeof CreateTemplateInputValidatedSchema>;
export interface CreateTemplateOutput {
  templateId: string;
}

// rename template
export const RenameTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
  newName: z.string().min(1),
});
export type RenameTemplateInput = z.infer<typeof RenameTemplateInputSchema>;
export const RenameTemplateInputValidatedSchema = RenameTemplateInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});
export type RenameTemplateInputValidated = z.infer<typeof RenameTemplateInputValidatedSchema>;
export type RenameTemplateOutput = void;

// delete template
export const DeleteTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
});
export type DeleteTemplateInput = z.infer<typeof DeleteTemplateInputSchema>;
export const DeleteTemplateInputValidatedSchema = DeleteTemplateInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});
export type DeleteTemplateInputValidated = z.infer<typeof DeleteTemplateInputValidatedSchema>;
export type DeleteTemplateOutput = void;
