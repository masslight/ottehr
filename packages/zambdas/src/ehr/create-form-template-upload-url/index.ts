import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  CreateFormTemplateUploadUrlInput,
  CreateFormTemplateUploadUrlOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken, requireAdminTierUser } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { makeZ3ObjectUrl } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl } from '../../shared/z3Utils';
import {
  createFormTemplateDraft,
  getFormTemplateOrThrow,
  makeFormTemplateObjectName,
} from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'create-form-template-upload-url';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    // Managing templates is an administration action; every clinical role can invoke any zambda,
    // so the role check has to happen here rather than being inferred from reachability.
    await requireAdminTierUser(validatedInput.userToken ?? '', validatedInput.secrets);
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

// Two shapes, not one with optional halves: replacing a PDF has no use for a title, and a payload
// carrying both matches neither branch rather than quietly creating a second template.
const inputSchema: z.ZodType<CreateFormTemplateUploadUrlInput> = z.union([
  z.object({
    fileName: z.string().min(1, 'fileName is required'),
    documentReferenceId: z.string().min(1),
    title: z.undefined(),
    description: z.undefined(),
  }),
  z.object({
    fileName: z.string().min(1, 'fileName is required'),
    title: z.string().min(1, 'title is required'),
    description: z.string().optional(),
    documentReferenceId: z.undefined(),
  }),
]);

export function validateRequestParameters(
  input: ZambdaInput
): CreateFormTemplateUploadUrlInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string } {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
    // Who is asking, as opposed to the machine identity that does the writing.
    userToken: input.headers?.Authorization?.replace('Bearer ', ''),
  };
}

const performEffect = async (
  validatedInput: CreateFormTemplateUploadUrlInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string },
  oystehr: Oystehr,
  token: string
): Promise<CreateFormTemplateUploadUrlOutput> => {
  const { secrets } = validatedInput;

  const objectName = makeFormTemplateObjectName(validatedInput.fileName);
  const z3Url = makeZ3ObjectUrl({ secrets, bucketName: BUCKET_NAMES.FORM_TEMPLATES, objectName });
  const presignedUploadUrl = await createPresignedUrl(token, z3Url, 'upload');

  // Replacing an existing template's PDF: hand back a candidate location and change nothing. The
  // template keeps pointing at its current file until the upload has been fetched and analysed, so a
  // failed replacement leaves a working template working.
  // Compared against undefined rather than tested for truth: that is the discriminant between the two
  // input shapes, and truthiness would not narrow it because a string can itself be falsy.
  if (validatedInput.documentReferenceId !== undefined) {
    await getFormTemplateOrThrow(oystehr, validatedInput.documentReferenceId);
    return { documentReferenceId: validatedInput.documentReferenceId, objectName, presignedUploadUrl };
  }

  // Created before the bytes exist: the browser does the uploading and needs somewhere to send them.
  const createdId = await createFormTemplateDraft({
    oystehr,
    title: validatedInput.title,
    description: validatedInput.description,
    z3Url,
  });

  return { documentReferenceId: createdId, objectName, presignedUploadUrl };
};
