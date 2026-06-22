import { AdminRenameTemplateInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const AdminRenameTemplateSchema = z.object({
  templateId: z.string().uuid(),
  newName: z.string().trim().min(1),
});

export function validateRequestParameters(input: ZambdaInput): AdminRenameTemplateInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body) as unknown;
  const { templateId, newName } = safeValidate(AdminRenameTemplateSchema, parsed);

  return {
    templateId,
    newName,
    secrets: input.secrets,
  };
}
