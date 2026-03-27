import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  AdminListTemplateItem,
  examConfig,
  ExamType,
  getSecret,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
  ListAllTemplatesInputSchema,
  ListAllTemplatesInputValidated,
  ListAllTemplatesInputValidatedSchema,
  ListAllTemplatesOutput,
  SecretsKeys,
} from 'utils';
import { ZodError } from 'zod';
import { checkOrCreateM2MClientToken, formatZodError, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';

let m2mToken: string;

export const index = wrapHandler('list-all-templates', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedInput = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedInput));

    const { secrets } = validatedInput;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.group('performEffect');
    const result = await performEffect(validatedInput, oystehr);
    console.groupEnd();
    console.debug('performEffect success', JSON.stringify(result));

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('list-all-templates', error, ENVIRONMENT);
  }
});

const validateRequestParameters = (input: ZambdaInput): ListAllTemplatesInputValidated => {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw new Error('Invalid JSON in request body.');
  }

  try {
    const validatedCore = ListAllTemplatesInputSchema.parse(parsed);

    const validated = ListAllTemplatesInputValidatedSchema.parse({
      ...validatedCore,
      secrets: input.secrets,
    });

    return validated;
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(`Invalid request parameters: ${formatZodError(err)}`);
    }
    throw err;
  }
};

const performEffect = async (
  validatedInput: ListAllTemplatesInputValidated,
  oystehr: Oystehr
): Promise<ListAllTemplatesOutput> => {
  const { filter } = validatedInput;

  const listSearchResult = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        // todo consider result pagination since it's likely to exceed 6MB lambda limit
        {
          name: '_tag',
          value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|`,
        },
        {
          name: '_include',
          value: 'List:item',
        },
      ],
    })
  ).unbundle();

  if (!listSearchResult || listSearchResult.length === 0) {
    return { templates: [] };
  }

  // Filter out the holder list
  const templateLists = listSearchResult.filter(
    (resource) => !resource.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM)
  );

  const templates: AdminListTemplateItem[] = [];
  for (const template of templateLists) {
    if (!template.id || !template.title) {
      continue;
    }
    const typeAndStatus = getExamTypeAndVersionStatus(template);
    if (!typeAndStatus) {
      continue;
    }
    if (filter && !template.title.includes(filter)) {
      continue;
    }
    templates.push({
      id: template.id,
      name: template.title,
      versionStatus: typeAndStatus.versionStatus,
      examType: typeAndStatus.examType,
    });
  }
  templates.sort((a, b) => a.name.localeCompare(b.name));

  console.log(
    'Filtered (if applicable) templates:',
    templates.map((t) => t.name)
  );

  return { templates };
};

const getExamTypeAndVersionStatus = (
  template: List
): { examType: ExamType; versionStatus: 'current' | 'stale' } | undefined => {
  const inPersonCoding = template.code?.coding?.find((c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM);
  if (inPersonCoding) {
    return {
      examType: ExamType.IN_PERSON,
      versionStatus: inPersonCoding.version === examConfig.inPerson.default.version ? 'current' : 'stale',
    };
  }

  const telemedCoding = template.code?.coding?.find((c) => c.system === GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM);
  if (telemedCoding) {
    return {
      examType: ExamType.TELEMED,
      versionStatus: telemedCoding.version === examConfig.telemed.default.version ? 'current' : 'stale',
    };
  }

  return undefined;
};
