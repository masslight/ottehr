import { AdminCreateTemplateInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const AdminCreateTemplateSchema = z.object({
  encounterId: z.string().uuid(),
  templateName: z.string().trim().min(1),
});

export function validateRequestParameters(input: ZambdaInput): AdminCreateTemplateInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body) as unknown;
  const { encounterId, templateName } = safeValidate(AdminCreateTemplateSchema, parsed);

  return {
    encounterId,
    templateName,
    secrets: input.secrets,
  };
}
