import {
  AdminInHouseLabItemDefinitionSchema,
  AdminUpdateInHouseLabInput,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  Secrets,
} from 'utils';
import { z } from 'zod';
import { safeJsonParse, ZambdaInput } from '../../../../shared';

const AdminUpdateInHouseLabStatusSchema = z.object({
  updateType: z.literal('toggle-status'),
  data: z.object({
    activityDefinitionId: z.string(),
  }),
});

const AdminEditInHouseLabSchema = z.object({
  updateType: z.literal('edit'),
  data: z.object({
    activityDefinitionIdToRetire: z.string(),
    canonicalUrl: z.string(),
    versionToRetire: z.string(),
    newData: AdminInHouseLabItemDefinitionSchema,
  }),
});

const validationSchema = z.object({
  userId: z.string(),
  data: z.discriminatedUnion('updateType', [AdminEditInHouseLabSchema, AdminUpdateInHouseLabStatusSchema]),
});

export function validateRequestParameters(
  input: ZambdaInput
): AdminUpdateInHouseLabInput & { secrets: Secrets | null; userToken: string } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');
  const secrets = input.secrets;

  let params: AdminUpdateInHouseLabInput;
  try {
    params = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const validatedParsed = validationSchema.safeParse(params);
  if (!validatedParsed.success) {
    console.error(
      'Hit validation error during zod parsing. Tried to parse this json:',
      JSON.stringify(validatedParsed.error.errors),
      JSON.stringify(params)
    );
    throw INVALID_INPUT_ERROR(`Validation failed: ${JSON.stringify(validatedParsed.error.errors)}`);
  }

  if (!params.userId) {
    throw INVALID_INPUT_ERROR('No user id provided');
  }

  return {
    userId: params.userId,
    data: params.data,
    secrets,
    userToken,
  };
}
