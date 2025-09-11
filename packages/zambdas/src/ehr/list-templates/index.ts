import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  examConfig,
  ExamType,
  getSecret,
  ListTemplatesZambdaInput,
  ListTemplatesZambdaOutput,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import {
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
} from '../../shared/templates';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('list-templates', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);

    const { secrets } = validatedInput;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const templates = await performEffect(validatedInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(templates),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return await topLevelCatch('apply-template', error, ENVIRONMENT);
  }
});

const performEffect = async (
  validatedInput: ListTemplatesZambdaInput,
  oystehr: Oystehr
): Promise<ListTemplatesZambdaOutput> => {
  const { examType } = validatedInput;

  const listSearchResult = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: '_tag', value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|` },
        { name: '_include', value: 'List:item' },
        // Beware, this may tip over the 6MB limit on lambda response payload if you have a lot of templates.
        // Then paginate the results if necessary
      ],
    })
  ).unbundle();

  if (!listSearchResult || listSearchResult.length === 0) {
    throw new Error(`Could not fetch templates.`);
  }

  // Filter out the global templates holder List
  let filteredTemplates = listSearchResult.filter(
    (template) => !template.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM)
  );

  // Filter out the templates which are not for the requested examType and the latest version
  filteredTemplates = filteredTemplates.filter((template) => {
    if (examType === ExamType.IN_PERSON) {
      return template.code?.coding?.some(
        (c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM && c.version === examConfig.inPerson.default.version
      );
    } else if (examType === ExamType.TELEMED) {
      return template.code?.coding?.some(
        (c) => c.system === GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM && c.version === examConfig.telemed.default.version
      );
    }
    return false;
  });

  const templateTitles = filteredTemplates
    .map((template) => {
      return template.title;
    })
    .filter((title): title is string => typeof title === 'string'); // Filter out undefined titles

  console.log('Templates:', templateTitles);

  return { templates: templateTitles };
};
