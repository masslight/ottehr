import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import {
  FORM_TEMPLATE_ANALYSIS_EXTENSION_URL,
  FORM_TEMPLATE_FIELD_INVENTORY_EXTENSION_URL,
  FORM_TEMPLATE_FILLABILITY_SYSTEM,
  FormTemplateFillability,
} from 'utils/lib/fhir/constants';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  AnalyzeFormTemplateInput,
  AnalyzeFormTemplateOutput,
  FormTemplateAnalysisStatus,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl, deleteZ3Object, uploadObjectToZ3 } from '../../shared/z3Utils';
import { getFormTemplateOrThrow } from '../shared/form-template-helpers';
import { analyzeFormTemplatePdf } from '../shared/form-template-pdf';

const ZAMBDA_NAME = 'analyze-form-template';

/** Statuses that mean the upload can never be used, so the half-created template is removed. */
const REJECTED: ReadonlySet<FormTemplateAnalysisStatus> = new Set<FormTemplateAnalysisStatus>([
  'encrypted',
  'dynamicXfa',
  'unreadable',
]);

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

const inputSchema: z.ZodType<AnalyzeFormTemplateInput> = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
});

export function validateRequestParameters(input: ZambdaInput): AnalyzeFormTemplateInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

const performEffect = async (
  validatedInput: AnalyzeFormTemplateInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<AnalyzeFormTemplateOutput> => {
  const { documentReferenceId } = validatedInput;

  const docRef = await getFormTemplateOrThrow(oystehr, documentReferenceId);
  const z3Url = docRef.content?.[0]?.attachment?.url;
  if (!z3Url) {
    throw new Error(`Form template DocumentReference/${documentReferenceId} has no attachment URL`);
  }

  const downloadUrl = await getPresignedURL(z3Url, token);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Could not download the uploaded template (${response.status} ${response.statusText})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());

  const { status, fields, normalized } = await analyzeFormTemplatePdf(bytes);

  if (REJECTED.has(status)) {
    // Nothing about this upload is usable, so leave nothing behind. The template was only ever a draft,
    // so no chart has seen it and no mapping can reference it.
    await oystehr.fhir.delete({ resourceType: 'DocumentReference', id: documentReferenceId });
    try {
      await deleteZ3Object(z3Url, token);
    } catch (cleanupErr) {
      console.warn('Failed to remove the Z3 object for a rejected form template', z3Url, cleanupErr);
    }
    return { documentReferenceId, status, fields: [] };
  }

  // Normalization rewrites the file (today only to drop a redundant XFA layer), so the stored object has
  // to be replaced or viewers would still be reading the original.
  if (normalized?.changed) {
    const uploadUrl = await createPresignedUrl(token, z3Url, 'upload');
    await uploadObjectToZ3(normalized.bytes, uploadUrl);
  }

  const analysisSummary = { status, analyzedAt: new Date().toISOString() };
  const extensions = [
    ...(docRef.extension ?? []).filter(
      (ext) =>
        ext.url !== FORM_TEMPLATE_FIELD_INVENTORY_EXTENSION_URL && ext.url !== FORM_TEMPLATE_ANALYSIS_EXTENSION_URL
    ),
    { url: FORM_TEMPLATE_ANALYSIS_EXTENSION_URL, valueString: JSON.stringify(analysisSummary) },
    { url: FORM_TEMPLATE_FIELD_INVENTORY_EXTENSION_URL, valueString: JSON.stringify(fields) },
  ];

  // Fillability rides on `category` rather than in the extensions above, because listings need it and
  // an `_elements` projection cannot pull one extension without pulling the whole field inventory too.
  const categories = [
    ...(docRef.category ?? []).filter(
      (c) => !(c.coding ?? []).some((coding) => coding.system === FORM_TEMPLATE_FILLABILITY_SYSTEM)
    ),
    {
      coding: [
        {
          system: FORM_TEMPLATE_FILLABILITY_SYSTEM,
          code: status === 'fillable' ? FormTemplateFillability.fillable : FormTemplateFillability.printable,
        },
      ],
    },
  ];

  await oystehr.fhir.patch<DocumentReference>({
    resourceType: 'DocumentReference',
    id: documentReferenceId,
    operations: [
      { op: docRef.extension ? 'replace' : 'add', path: '/extension', value: extensions },
      { op: 'replace', path: '/category', value: categories },
    ],
  });

  return { documentReferenceId, status, fields };
};
