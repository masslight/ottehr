import { AdminDeleteTemplateInput, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const AdminDeleteTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): AdminDeleteTemplateInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body) as unknown;
  const { templateId } = safeValidate(AdminDeleteTemplateSchema, parsed);

  return {
    templateId,
    secrets: input.secrets,
  };
}
