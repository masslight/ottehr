import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import {
  FORM_TEMPLATE_ANALYSIS_EXTENSION_URL,
  FORM_TEMPLATE_FIELD_INVENTORY_EXTENSION_URL,
  FORM_TEMPLATE_FILLABILITY_SYSTEM,
  FORM_TEMPLATE_MAPPING_EXTENSION_URL,
  FormTemplateFillability,
} from 'utils/lib/fhir/constants';
import { EMPTY_MAPPING, FormTemplateMapping } from 'utils/lib/form-tokens/mapping';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  FormTemplateAnalysisStatus,
  ReplaceFormTemplatePdfInput,
  ReplaceFormTemplatePdfOutput,
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
import {
  FORM_TEMPLATE_DOC_STATUS,
  getFormTemplateOrThrow,
  readExtensionJson,
  reconcileMappingWithFields,
} from '../shared/form-template-helpers';
import { analyzeFormTemplatePdf } from '../shared/form-template-pdf';

const ZAMBDA_NAME = 'replace-form-template-pdf';

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

const inputSchema: z.ZodType<ReplaceFormTemplatePdfInput> = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
  z3Url: z.string().min(1, 'z3Url is required'),
});

export function validateRequestParameters(
  input: ZambdaInput
): ReplaceFormTemplatePdfInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

/**
 * Swaps the PDF behind an existing template, keeping whatever of its mapping still applies.
 *
 * Nothing about the template changes until the candidate upload has been fetched and analysed. A
 * replacement that turns out to be unreadable, encrypted or dynamic-XFA therefore leaves a working
 * template working — unlike a first upload, where a failure only strands a draft that never worked,
 * here there is a live template and an authored mapping worth protecting.
 */
const performEffect = async (
  validatedInput: ReplaceFormTemplatePdfInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<ReplaceFormTemplatePdfOutput> => {
  const { documentReferenceId, z3Url: candidateUrl } = validatedInput;

  const docRef = await getFormTemplateOrThrow(oystehr, documentReferenceId);
  const previousUrl = docRef.content?.[0]?.attachment?.url;

  const downloadUrl = await getPresignedURL(candidateUrl, token);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Could not download the replacement PDF (${response.status} ${response.statusText})`);
  }
  const { status, fields, normalized } = await analyzeFormTemplatePdf(new Uint8Array(await response.arrayBuffer()));

  if (REJECTED.has(status)) {
    // Discard the candidate and leave the template exactly as it was.
    try {
      await deleteZ3Object(candidateUrl, token);
    } catch (cleanupErr) {
      console.warn('Failed to remove a rejected replacement PDF', candidateUrl, cleanupErr);
    }
    return { documentReferenceId, status, fields: [], droppedBindings: [], returnedToDraft: false };
  }

  if (normalized?.changed) {
    await uploadObjectToZ3(normalized.bytes, await createPresignedUrl(token, candidateUrl, 'upload'));
  }

  const existingMapping = readExtensionJson<FormTemplateMapping>(docRef, FORM_TEMPLATE_MAPPING_EXTENSION_URL);
  const { mapping, dropped } = reconcileMappingWithFields(existingMapping ?? EMPTY_MAPPING, fields);

  const extensions = [
    ...(docRef.extension ?? []).filter(
      (ext) =>
        ext.url !== FORM_TEMPLATE_FIELD_INVENTORY_EXTENSION_URL &&
        ext.url !== FORM_TEMPLATE_ANALYSIS_EXTENSION_URL &&
        ext.url !== FORM_TEMPLATE_MAPPING_EXTENSION_URL
    ),
    {
      url: FORM_TEMPLATE_ANALYSIS_EXTENSION_URL,
      valueString: JSON.stringify({ status, analyzedAt: new Date().toISOString() }),
    },
    { url: FORM_TEMPLATE_FIELD_INVENTORY_EXTENSION_URL, valueString: JSON.stringify(fields) },
    { url: FORM_TEMPLATE_MAPPING_EXTENSION_URL, valueString: JSON.stringify(mapping) },
  ];

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

  // Losing bindings takes the template out of the chart until someone has looked at it. Providers would
  // otherwise keep opening a form that silently stopped filling in part of itself.
  const returnedToDraft = dropped.length > 0 && docRef.docStatus === FORM_TEMPLATE_DOC_STATUS.published;

  await oystehr.fhir.patch<DocumentReference>({
    resourceType: 'DocumentReference',
    id: documentReferenceId,
    operations: [
      { op: 'replace', path: '/content/0/attachment/url', value: candidateUrl },
      { op: docRef.extension ? 'replace' : 'add', path: '/extension', value: extensions },
      { op: 'replace', path: '/category', value: categories },
      ...(returnedToDraft
        ? [{ op: 'replace' as const, path: '/docStatus', value: FORM_TEMPLATE_DOC_STATUS.draft }]
        : []),
    ],
  });

  // Only now is the old file genuinely superseded. Failing here leaves an orphaned object rather than a
  // template pointing at nothing, which is the cheaper of the two failures.
  if (previousUrl && previousUrl !== candidateUrl) {
    try {
      await deleteZ3Object(previousUrl, token);
    } catch (cleanupErr) {
      console.warn('Failed to remove the superseded form template PDF', previousUrl, cleanupErr);
    }
  }

  return { documentReferenceId, status, fields, droppedBindings: dropped, returnedToDraft };
};
