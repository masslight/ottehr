import { AdminCreateTemplateInput } from 'utils/lib/types/data/admin-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

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

  const parsed = safeJsonParse(input.body) as unknown;
  const { encounterId, templateName } = safeValidate(AdminCreateTemplateSchema, parsed);

  return {
    encounterId,
    templateName,
    secrets: input.secrets,
  };
}
