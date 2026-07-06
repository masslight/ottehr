import { GetFaxDocumentsInput, MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const GetFaxDocumentsBodySchema = z.object({
  appointmentId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetFaxDocumentsInput & Pick<ZambdaInput, 'secrets'> {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const data = safeJsonParse(input.body);
  const { appointmentId } = safeValidate(GetFaxDocumentsBodySchema, data);

  return { appointmentId, secrets: input.secrets };
}
