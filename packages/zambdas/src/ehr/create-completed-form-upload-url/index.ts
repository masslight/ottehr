import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  CreateCompletedFormUploadUrlInput,
  CreateCompletedFormUploadUrlOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { makeZ3Url } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl } from '../../shared/z3Utils';

const ZAMBDA_NAME = 'create-completed-form-upload-url';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

    const result = await performEffect(validatedInput, oystehr, m2mToken);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const inputSchema: z.ZodType<CreateCompletedFormUploadUrlInput> = z.object({
  appointmentId: z.string().min(1, 'appointmentId is required'),
  fileName: z.string().min(1, 'fileName is required'),
});

export function validateRequestParameters(
  input: ZambdaInput
): CreateCompletedFormUploadUrlInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

/**
 * Hands back somewhere to put a completed form, and nothing else.
 *
 * Writes no FHIR at all — no DocumentReference, no folder entry. That is the point: the record is created
 * by `save-completed-form` once the bytes are in place and have been checked, so an upload that fails
 * halfway, or turns out to belong to another patient, leaves nothing behind on the chart.
 *
 * The patient comes from the appointment rather than the request, so a caller cannot name the chart a file
 * will be checked against.
 */
const performEffect = async (
  validatedInput: CreateCompletedFormUploadUrlInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<CreateCompletedFormUploadUrlOutput> => {
  const { appointmentId, fileName, secrets } = validatedInput;

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  const patientId = visitResources?.patient?.id;
  if (!patientId) {
    throw new Error(`No patient found for appointment ${appointmentId}`);
  }

  const z3Url = makeZ3Url({
    secrets,
    bucketName: BUCKET_NAMES.FORM_INSTANCES,
    patientID: patientId,
    fileName: sanitizeFileName(fileName),
  });

  return { z3Url, presignedUploadUrl: await createPresignedUrl(token, z3Url, 'upload') };
};

/** Keeps a user-supplied name from steering the object anywhere other than where it was meant to go. */
const sanitizeFileName = (fileName: string): string =>
  fileName
    .replace(/[/\\]/g, '-')
    .replace(/[^\w.-]/g, '_')
    .slice(0, 120) || 'completed-form.pdf';
