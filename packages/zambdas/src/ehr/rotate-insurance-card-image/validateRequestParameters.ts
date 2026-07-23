import { MISSING_AUTH_TOKEN, MISSING_REQUEST_BODY, RotateInsuranceCardImageInput } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

const RotateInsuranceCardImageBodySchema = z.object({
  documentReferenceId: z.string().uuid(),
  // CLOCKWISE; the only supported manual-rotate angles
  rotationDegrees: z.union([z.literal(90), z.literal(180), z.literal(270)]),
});

export function validateRequestParameters(
  input: ZambdaInput
): RotateInsuranceCardImageInput & Pick<ZambdaInput, 'secrets'> & { userToken: string } {
  if (input.headers.Authorization === undefined) {
    throw MISSING_AUTH_TOKEN;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body) as unknown;
  const data = safeValidate(RotateInsuranceCardImageBodySchema, parsed);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  return { ...data, secrets: input.secrets, userToken };
}
