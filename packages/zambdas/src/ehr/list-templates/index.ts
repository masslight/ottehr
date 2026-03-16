import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  examConfig,
  ExamType,
  getSecret,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
  ListTemplatesZambdaInput,
  ListTemplatesZambdaOutput,
  SecretsKeys,
  TemplateInfo,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
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
    return topLevelCatch('list-templates', error, ENVIRONMENT);
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
  const filteredTemplates = listSearchResult.filter(
    (template) => !template.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM)
  );

  const codeSystem =
    examType === ExamType.IN_PERSON ? GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM : GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM;
  const currentVersion =
    examType === ExamType.IN_PERSON ? examConfig.inPerson.default.version : examConfig.telemed.default.version;

  // Filter to templates matching the requested exam type code system
  const examTypeTemplates = filteredTemplates.filter(
    (template) => template.code?.coding?.some((c) => c.system === codeSystem)
  );

  const templateInfos: TemplateInfo[] = examTypeTemplates
    .map((template) => {
      const coding = template.code?.coding?.find((c) => c.system === codeSystem);
      const examVersion = coding?.version ?? '';

      return {
        id: template.id!,
        title: template.title ?? '',
        examVersion,
        isCurrentVersion: examVersion === currentVersion,
      };
    })
    .filter((info) => info.title !== '');

  templateInfos.sort((a, b) => a.title.localeCompare(b.title));

  console.log(
    'Templates:',
    templateInfos.map((t) => t.title)
  );

  return { templates: templateInfos };
};
