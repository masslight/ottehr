import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FORM_TEMPLATE_ANALYSIS_EXTENSION_URL,
  FORM_TEMPLATE_FIELD_INVENTORY_EXTENSION_URL,
  FORM_TEMPLATE_MAPPING_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { EMPTY_MAPPING } from 'utils/lib/form-tokens/mapping';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  FormFieldInfo,
  FormTemplateAnalysisStatus,
  GetFormTemplateDetailInput,
  GetFormTemplateDetailOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { getFormTemplateOrThrow, readExtensionJson, toFormTemplateItem } from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'get-form-template-detail';

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

const inputSchema: z.ZodType<GetFormTemplateDetailInput> = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
});

export function validateRequestParameters(
  input: ZambdaInput
): GetFormTemplateDetailInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

const performEffect = async (
  validatedInput: GetFormTemplateDetailInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<GetFormTemplateDetailOutput> => {
  const docRef = await getFormTemplateOrThrow(oystehr, validatedInput.documentReferenceId);

  const fields = readExtensionJson<FormFieldInfo[]>(docRef, FORM_TEMPLATE_FIELD_INVENTORY_EXTENSION_URL) ?? [];
  const analysis = readExtensionJson<{ status: FormTemplateAnalysisStatus }>(
    docRef,
    FORM_TEMPLATE_ANALYSIS_EXTENSION_URL
  );
  const mapping = readExtensionJson(docRef, FORM_TEMPLATE_MAPPING_EXTENSION_URL) ?? EMPTY_MAPPING;

  return {
    item: await toFormTemplateItem(docRef, token),
    // Templates uploaded before analysis existed have no stored status; treat them by what they contain.
    status: analysis?.status ?? (fields.length > 0 ? 'fillable' : 'printable'),
    fields,
    mapping,
  };
};
