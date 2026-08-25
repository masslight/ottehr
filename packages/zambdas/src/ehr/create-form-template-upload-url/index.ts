import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES, FORM_TEMPLATE_CATEGORY_CODING, FORM_TEMPLATE_IDENTIFIER_SYSTEM } from 'utils/lib/fhir/constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  CreateFormTemplateUploadUrlInput,
  CreateFormTemplateUploadUrlOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { makeZ3FileUrl } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl } from '../../shared/z3Utils';
import { FORM_TEMPLATE_DOC_STATUS } from '../shared/form-template-helpers';

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
  const { title, description, fileName, secrets } = validatedInput;

  // A UUID segment keeps two same-day uploads of the same file name from colliding; makeZ3FileUrl
  // already prefixes the date. Templates are org-level, so this URL carries no patient path segment.
  const objectName = `${randomUUID()}-${sanitizeFileNameForZ3(fileName)}`;
  const z3Url = makeZ3FileUrl({ secrets, bucketName: BUCKET_NAMES.FORM_TEMPLATES, fileName: objectName });
  const presignedUploadUrl = await createPresignedUrl(token, z3Url, 'upload');

  const identifierValue = randomUUID();
  const docRef: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    // Created as a draft. The client PUTs the file after this call returns, so the record briefly points
    // at an object that does not exist yet; leaving it unpublished means a failed upload surfaces as a
    // visibly broken draft rather than reaching the patient chart.
    docStatus: FORM_TEMPLATE_DOC_STATUS.draft,
    category: [{ coding: [FORM_TEMPLATE_CATEGORY_CODING] }],
    identifier: [{ system: FORM_TEMPLATE_IDENTIFIER_SYSTEM, value: identifierValue }],
    date: DateTime.now().setZone('UTC').toISO() ?? '',
    description,
    content: [
      {
        attachment: {
          url: z3Url,
          contentType: 'application/pdf',
          title,
        },
      },
    ],
  };

  const created = await oystehr.fhir.create<DocumentReference>(docRef);
  if (!created.id) {
    throw new Error('Failed to create DocumentReference for form template');
  }

  return {
    documentReferenceId: created.id,
    identifier: identifierValue,
    z3Url,
    presignedUploadUrl,
  };
};
