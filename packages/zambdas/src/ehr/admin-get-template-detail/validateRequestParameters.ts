import { AdminGetTemplateDetailInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const AdminGetTemplateDetailSchema = z.object({
  templateId: z.string().uuid(),
});

export function validateRequestParameters(
  input: ZambdaInput
): AdminGetTemplateDetailInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body) as unknown;
  const { templateId } = safeValidate(AdminGetTemplateDetailSchema, parsed);

  return {
    templateId,
    secrets: input.secrets,
  };
}
