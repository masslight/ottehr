import {
  ApplyTemplateZambdaInput,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  TEMPLATE_SECTION_DEFAULT_ACTIONS,
  TEMPLATE_SECTIONS_NO_APPEND,
  TemplateSectionAction,
  TemplateSectionActions,
  TemplateSectionKey,
} from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const VALID_ACTIONS: readonly TemplateSectionAction[] = ['skip', 'overwrite', 'append'];

const VALID_SECTION_KEYS: ReadonlySet<TemplateSectionKey> = new Set(
  Object.keys(TEMPLATE_SECTION_DEFAULT_ACTIONS) as TemplateSectionKey[]
);

const sectionActionsSchema = z
  .record(z.string(), z.string())
  .optional()
  .superRefine((raw, ctx) => {
    if (raw === undefined) return;
    for (const [key, value] of Object.entries(raw)) {
      if (!VALID_SECTION_KEYS.has(key as TemplateSectionKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown template section: ${key}`,
        });
        return;
      }
      if (!VALID_ACTIONS.includes(value as TemplateSectionAction)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid action for section ${key}: ${value}. Must be one of: ${VALID_ACTIONS.join(', ')}`,
        });
        return;
      }
      if (value === 'append' && TEMPLATE_SECTIONS_NO_APPEND.has(key as TemplateSectionKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Section ${key} does not support the 'append' action`,
        });
        return;
      }
    }
  });

const ApplyTemplateSchema = z.object({
  templateName: z.string().trim().min(1),
  encounterId: z.string().trim().min(1),
  sectionActions: sectionActionsSchema,
});

export function validateRequestParameters(input: ZambdaInput): ApplyTemplateZambdaInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body) as unknown;
  const { templateName, encounterId, sectionActions } = safeValidate(ApplyTemplateSchema, parsed);

  const validatedSectionActions: TemplateSectionActions = (sectionActions as TemplateSectionActions) ?? {};

  return {
    templateName,
    encounterId,
    sectionActions: validatedSectionActions,
    secrets: input.secrets,
  };
}
