import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { DeleteFormTemplateInput, DeleteFormTemplateOutput } from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { deleteZ3Object } from '../../shared/z3Utils';
import { getFormTemplateOrThrow } from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'delete-form-template';

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

const inputSchema: z.ZodType<DeleteFormTemplateInput> = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
  permanent: z.boolean().optional(),
});

export function validateRequestParameters(input: ZambdaInput): DeleteFormTemplateInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

const performEffect = async (
  validatedInput: DeleteFormTemplateInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<DeleteFormTemplateOutput> => {
  const { documentReferenceId, permanent } = validatedInput;

  const docRef = await getFormTemplateOrThrow(oystehr, documentReferenceId);

  if (!permanent) {
    // Soft delete. `status` is a FHIR modifier element, so marking the reference superseded takes the
    // template out of every list without destroying anything, and it is a searchable parameter.
    await oystehr.fhir.patch<DocumentReference>({
      resourceType: 'DocumentReference',
      id: documentReferenceId,
      operations: [replaceOperation('/status', 'superseded')],
    });
    return { success: true };
  }

  const z3Url = docRef.content?.[0]?.attachment?.url;

  await oystehr.fhir.delete({ resourceType: 'DocumentReference', id: documentReferenceId });

  // Best-effort: the record is already gone, so a failure here leaves an orphaned object rather than a
  // template that looks deleted but is not. Worth logging, not worth failing the request.
  if (z3Url) {
    try {
      await deleteZ3Object(z3Url, token);
    } catch (cleanupErr) {
      console.warn('Failed to delete Z3 object for form template', z3Url, cleanupErr);
    }
  }

  return { success: true };
};
