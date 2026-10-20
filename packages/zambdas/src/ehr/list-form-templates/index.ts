import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { FORM_TEMPLATE_CATEGORY_SEARCH_PARAM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  FormTemplateItem,
  ListFormTemplatesInput,
  ListFormTemplatesOutput,
} from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken, requireAdminTierUser } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { FORM_TEMPLATE_LIST_ELEMENTS, isPublished, toFormTemplateItem } from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'list-form-templates';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    // Published templates are what the chart lists, so this stays open to providers. Drafts are not:
    // they carry presigned links to PDFs nobody has approved for use yet.
    if (validatedInput.includeUnpublished) {
      await requireAdminTierUser(validatedInput.userToken ?? '', validatedInput.secrets);
    }
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

const inputSchema: z.ZodType<ListFormTemplatesInput> = z.object({
  includeUnpublished: z.boolean().optional(),
});

export function validateRequestParameters(
  input: ZambdaInput
): ListFormTemplatesInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string } {
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  // The chart calls this with no body at all, which is equivalent to published-only.
  const parsed = input.body ? safeValidate(inputSchema, safeJsonParse(input.body)) : {};

  return {
    ...parsed,
    secrets: input.secrets,
    // Who is asking, as opposed to the machine identity that does the writing.
    userToken: input.headers?.Authorization?.replace('Bearer ', ''),
  };
}

const performEffect = async (
  validatedInput: ListFormTemplatesInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string },
  oystehr: Oystehr,
  token: string
): Promise<ListFormTemplatesOutput> => {
  const { includeUnpublished } = validatedInput;

  // Every page. A single search returns one server-sized page, so once a project has more templates than
  // that, the rest would vanish from the admin list and from every chart — silently, and worse as the
  // project grows.
  const searchResult = await getAllFhirSearchPages<DocumentReference>(
    {
      resourceType: 'DocumentReference',
      params: [
        { name: 'category', value: FORM_TEMPLATE_CATEGORY_SEARCH_PARAM },
        // Soft-deleted templates are `superseded`; only `current` ones are live anywhere.
        { name: 'status', value: 'current' },
        { name: '_elements', value: FORM_TEMPLATE_LIST_ELEMENTS.join(',') },
      ],
    },
    oystehr
  );

  // `docStatus` is not a FHIR search parameter, so draft filtering happens here rather than in the query.
  const docRefs = searchResult
    .filter((docRef) => includeUnpublished || isPublished(docRef))
    .filter((docRef) => {
      if (!docRef.content?.[0]?.attachment?.url) {
        console.warn(`Skipping form template DocumentReference/${docRef.id} — missing attachment URL`);
        return false;
      }
      return true;
    });

  const items: FormTemplateItem[] = await Promise.all(docRefs.map((docRef) => toFormTemplateItem(docRef, token)));

  return { items };
};
