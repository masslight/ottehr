import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { FORM_TEMPLATE_MAPPING_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { SaveFormTemplateMappingInput, SaveFormTemplateMappingOutput } from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { getFormTemplateOrThrow, withExtensionJson } from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'save-form-template-mapping';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

    const result = await performEffect(validatedInput, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const transformSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('dateFormat'),
    format: z.enum(['MM/DD/YYYY', 'M/D/YYYY', 'YYYY-MM-DD', 'MMMM D, YYYY', 'month', 'day', 'year']),
  }),
  z.object({ kind: z.literal('booleanText'), trueText: z.string(), falseText: z.string() }),
]);

const mappingSchema = z.object({
  version: z.literal(1),
  bindings: z.array(
    z.object({
      fieldName: z.string().min(1),
      tokenKey: z.string().min(1),
      transform: transformSchema.optional(),
      fallback: z.string().optional(),
    })
  ),
});

const inputSchema = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
  mapping: mappingSchema,
});

export function validateRequestParameters(
  input: ZambdaInput
): SaveFormTemplateMappingInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

const performEffect = async (
  validatedInput: SaveFormTemplateMappingInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr
): Promise<SaveFormTemplateMappingOutput> => {
  const { documentReferenceId, mapping } = validatedInput;

  const docRef = await getFormTemplateOrThrow(oystehr, documentReferenceId);

  // Replace only the mapping extension: the field inventory and analysis live alongside it and must
  // survive a mapping save untouched.
  await oystehr.fhir.patch<DocumentReference>({
    resourceType: 'DocumentReference',
    id: documentReferenceId,
    operations: [
      {
        op: docRef.extension ? 'replace' : 'add',
        path: '/extension',
        value: withExtensionJson(docRef, FORM_TEMPLATE_MAPPING_EXTENSION_URL, mapping),
      },
    ],
  });

  return { documentReferenceId };
};
