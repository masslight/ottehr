import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  CreateFormTemplateUploadUrlInput,
  CreateFormTemplateUploadUrlOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl } from '../../shared/z3Utils';
import {
  createFormTemplateDraft,
  getFormTemplateOrThrow,
  makeFormTemplateZ3Url,
} from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'create-form-template-upload-url';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

    const result = await performEffect(validatedInput, oystehr, m2mToken);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const inputSchema: z.ZodType<CreateFormTemplateUploadUrlInput> = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
  fileName: z.string().min(1, 'fileName is required'),
  documentReferenceId: z.string().min(1).optional(),
});

export function validateRequestParameters(
  input: ZambdaInput
): CreateFormTemplateUploadUrlInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

const performEffect = async (
  validatedInput: CreateFormTemplateUploadUrlInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<CreateFormTemplateUploadUrlOutput> => {
  const { title, description, fileName, documentReferenceId, secrets } = validatedInput;

  const z3Url = makeFormTemplateZ3Url(secrets, fileName);
  const presignedUploadUrl = await createPresignedUrl(token, z3Url, 'upload');

  // Replacing an existing template's PDF: hand back a candidate location and change nothing. The
  // template keeps pointing at its current file until the upload has been fetched and analysed, so a
  // failed replacement leaves a working template working.
  if (documentReferenceId) {
    await getFormTemplateOrThrow(oystehr, documentReferenceId);
    return { documentReferenceId, z3Url, presignedUploadUrl };
  }

  // Created before the bytes exist: the browser does the uploading and needs somewhere to send them.
  const createdId = await createFormTemplateDraft({ oystehr, title, description, z3Url });

  return { documentReferenceId: createdId, z3Url, presignedUploadUrl };
};
