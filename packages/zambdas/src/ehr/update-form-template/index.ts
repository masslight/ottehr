import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { DocumentReference } from 'fhir/r4b';
import { FORM_TEMPLATE_ANALYSIS_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { addOperation, replaceOperation } from 'utils/lib/helpers/operations';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  FormTemplateAnalysisStatus,
  UpdateFormTemplateInput,
  UpdateFormTemplateOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken, requireAdminTierUser } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { FORM_TEMPLATE_DOC_STATUS, getFormTemplateOrThrow, readExtensionJson } from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'update-form-template';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    // Managing templates is an administration action; every clinical role can invoke any zambda,
    // so the role check has to happen here rather than being inferred from reachability.
    await requireAdminTierUser(validatedInput.userToken ?? '', validatedInput.secrets);
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

const inputSchema: z.ZodType<UpdateFormTemplateInput> = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
  title: z.string().min(1, 'title cannot be empty').optional(),
  description: z.string().optional(),
  published: z.boolean().optional(),
});

export function validateRequestParameters(
  input: ZambdaInput
): UpdateFormTemplateInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string } {
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
  validatedInput: UpdateFormTemplateInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string },
  oystehr: Oystehr
): Promise<UpdateFormTemplateOutput> => {
  const { documentReferenceId, title, description, published } = validatedInput;

  const existing = await getFormTemplateOrThrow(oystehr, documentReferenceId);

  // Patch rather than PUT so an edit touches only the fields it names. A template's mapping lives in an
  // extension on this same resource, and a whole-resource write would carry a stale copy of it back.
  const operations: Operation[] = [];

  if (title !== undefined) {
    operations.push(replaceOperation('/content/0/attachment/title', title));
  }

  if (description !== undefined) {
    const path = '/description';
    operations.push(
      existing.description === undefined ? addOperation(path, description) : replaceOperation(path, description)
    );
  }

  if (published) {
    // Publishing is the moment a template becomes visible in every chart, so it is the right place to
    // insist the PDF was actually found usable. A rejected upload is normally deleted by analysis, but a
    // draft that was never analysed at all has no stored status and would otherwise sail through.
    const analysis = readExtensionJson<{ status: FormTemplateAnalysisStatus }>(
      existing,
      FORM_TEMPLATE_ANALYSIS_EXTENSION_URL
    );
    if (analysis && analysis.status !== 'fillable' && analysis.status !== 'printable') {
      throw new Error(`Cannot publish a template whose analysis reported "${analysis.status}"`);
    }
  }

  if (published !== undefined) {
    const docStatus = published ? FORM_TEMPLATE_DOC_STATUS.published : FORM_TEMPLATE_DOC_STATUS.draft;
    const path = '/docStatus';
    operations.push(
      existing.docStatus === undefined ? addOperation(path, docStatus) : replaceOperation(path, docStatus)
    );
  }

  if (operations.length > 0) {
    await oystehr.fhir.patch<DocumentReference>({
      resourceType: 'DocumentReference',
      id: documentReferenceId,
      operations,
    });
  }

  return { documentReferenceId };
};
