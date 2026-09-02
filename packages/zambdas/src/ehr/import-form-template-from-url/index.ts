import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  FORM_TEMPLATE_CATEGORY_CODING,
  FORM_TEMPLATE_IDENTIFIER_SYSTEM,
  FORM_TEMPLATE_SOURCE_URL_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  ImportFormTemplateFromUrlInput,
  ImportFormTemplateFromUrlOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { fetchRemotePdf, RemotePdfError } from '../../shared/fetch-remote-pdf';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { makeZ3FileUrl } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { FORM_TEMPLATE_DOC_STATUS } from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'import-form-template-from-url';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

    const result = await performEffect(validatedInput, oystehr, m2mToken);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error: unknown) {
    // A rejected address is the administrator's problem to fix, not a fault to bury in a 500.
    if (error instanceof RemotePdfError) {
      return { statusCode: 400, body: JSON.stringify({ message: error.message, reason: error.reason }) };
    }
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const inputSchema: z.ZodType<ImportFormTemplateFromUrlInput> = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
  sourceUrl: z.string().min(1, 'sourceUrl is required'),
});

export function validateRequestParameters(
  input: ZambdaInput
): ImportFormTemplateFromUrlInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

/**
 * Creates a template from a published PDF at a public address.
 *
 * Fetched and stored rather than linked. A government form's publisher will revise or move it, and a
 * template whose bytes can change underneath an authored field mapping is one whose mapping silently stops
 * describing the document. The address is recorded as provenance only.
 *
 * The record is created only once usable bytes are in hand, so an address that turns out to be wrong,
 * unreachable, or not a PDF leaves nothing behind. That is the opposite order from the file-upload path,
 * which has to create the record first because the browser does the uploading — here the server has the
 * bytes before it writes anything, so there is no reason to write optimistically.
 *
 * Triage of the PDF itself — encrypted, dynamic XFA, no fields — belongs to `analyze-form-template`, which
 * the caller runs next exactly as it does after a file upload.
 */
const performEffect = async (
  validatedInput: ImportFormTemplateFromUrlInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<ImportFormTemplateFromUrlOutput> => {
  const { title, description, sourceUrl, secrets } = validatedInput;

  const { bytes, finalUrl } = await fetchRemotePdf(sourceUrl);
  console.log(`${ZAMBDA_NAME}: fetched ${bytes.length} bytes from ${finalUrl}`);

  const objectName = `${randomUUID()}-${sanitizeFileNameForZ3(fileNameFromUrl(finalUrl))}`;
  const z3Url = makeZ3FileUrl({ secrets, bucketName: BUCKET_NAMES.FORM_TEMPLATES, fileName: objectName });
  await uploadObjectToZ3(bytes, await createPresignedUrl(token, z3Url, 'upload'));

  const identifierValue = randomUUID();
  const created = await oystehr.fhir.create<DocumentReference>({
    resourceType: 'DocumentReference',
    status: 'current',
    // A draft until analysis has looked at it, same as an uploaded file.
    docStatus: FORM_TEMPLATE_DOC_STATUS.draft,
    category: [{ coding: [FORM_TEMPLATE_CATEGORY_CODING] }],
    identifier: [{ system: FORM_TEMPLATE_IDENTIFIER_SYSTEM, value: identifierValue }],
    date: DateTime.now().setZone('UTC').toISO() ?? '',
    description,
    extension: [{ url: FORM_TEMPLATE_SOURCE_URL_EXTENSION_URL, valueUrl: finalUrl }],
    content: [{ attachment: { url: z3Url, contentType: 'application/pdf', title } }],
  });

  if (!created.id) {
    throw new Error('Failed to create DocumentReference for the imported form template');
  }

  return { documentReferenceId: created.id, identifier: identifierValue, resolvedFrom: finalUrl };
};

/** The published file's own name, which is a better default title for the stored object than a UUID alone. */
const fileNameFromUrl = (url: string): string => {
  const last = new URL(url).pathname.split('/').filter(Boolean).pop();
  return last && last.toLowerCase().endsWith('.pdf') ? last : 'form.pdf';
};
