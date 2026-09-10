import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  ImportFormTemplateFromUrlInput,
  ImportFormTemplateFromUrlOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken, requireAdminTierUser } from '../../shared/auth';
import { fetchRemotePdf, RemotePdfError } from '../../shared/fetch-remote-pdf';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { makeZ3ObjectUrl } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import {
  createFormTemplateDraft,
  getFormTemplateOrThrow,
  makeFormTemplateObjectName,
} from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'import-form-template-from-url';

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

// Two shapes, not one with optional halves — see `create-form-template-upload-url`.
const inputSchema: z.ZodType<ImportFormTemplateFromUrlInput> = z.union([
  z.object({
    sourceUrl: z.string().min(1, 'sourceUrl is required'),
    documentReferenceId: z.string().min(1),
    title: z.undefined(),
    description: z.undefined(),
  }),
  z.object({
    sourceUrl: z.string().min(1, 'sourceUrl is required'),
    title: z.string().min(1, 'title is required'),
    description: z.string().optional(),
    documentReferenceId: z.undefined(),
  }),
]);

export function validateRequestParameters(
  input: ZambdaInput
): ImportFormTemplateFromUrlInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string } {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
    // Who is asking, as opposed to the machine identity that does the writing.
    userToken: input.headers?.Authorization?.replace('Bearer ', ''),
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
  validatedInput: ImportFormTemplateFromUrlInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string },
  oystehr: Oystehr,
  token: string
): Promise<ImportFormTemplateFromUrlOutput> => {
  const { secrets } = validatedInput;

  const { bytes, finalUrl } = await fetchRemotePdf(validatedInput.sourceUrl, secrets);
  console.log(`${ZAMBDA_NAME}: fetched ${bytes.length} bytes from ${finalUrl}`);

  const objectName = makeFormTemplateObjectName(fileNameFromUrl(finalUrl));
  const z3Url = makeZ3ObjectUrl({ secrets, bucketName: BUCKET_NAMES.FORM_TEMPLATES, objectName });
  await uploadObjectToZ3(bytes, await createPresignedUrl(token, z3Url, 'upload'));

  // Replacing: the bytes are parked and nothing else touched. `replace-form-template-pdf` decides whether
  // they are fit to adopt, so a fetch that succeeds but yields an unusable PDF costs a stored object and
  // nothing more.
  // Compared against undefined rather than tested for truth: that is the discriminant between the two
  // input shapes, and truthiness would not narrow it because a string can itself be falsy.
  if (validatedInput.documentReferenceId !== undefined) {
    await getFormTemplateOrThrow(oystehr, validatedInput.documentReferenceId);
    return { objectName, resolvedFrom: finalUrl };
  }

  const createdId = await createFormTemplateDraft({
    oystehr,
    title: validatedInput.title,
    description: validatedInput.description,
    z3Url,
    sourceUrl: finalUrl,
  });

  return { objectName, resolvedFrom: finalUrl, documentReferenceId: createdId };
};

/** The published file's own name, which is a better default title for the stored object than a UUID alone. */
const fileNameFromUrl = (url: string): string => {
  const last = new URL(url).pathname.split('/').filter(Boolean).pop();
  return last && last.toLowerCase().endsWith('.pdf') ? last : 'form.pdf';
};
