import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List, Resource } from 'fhir/r4b';
import {
  chartDataTagSystem,
  chunkThings,
  collectKnownExamFields,
  collectKnownRosFields,
  examConfig,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  ListTemplatesZambdaInput,
  ListTemplatesZambdaOutput,
  TemplateInfo,
  TemplateVersionData,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { analyzeTemplateVersionData, findHolderList } from '../shared/template-helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('list-templates', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);

  const { secrets } = validatedInput;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const templates = await performEffect(validatedInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(templates),
  };
});

const performEffect = async (
  validatedInput: ListTemplatesZambdaInput,
  oystehr: Oystehr
): Promise<ListTemplatesZambdaOutput> => {
  const { includeVersionData } = validatedInput;

  // Find the holder list
  const holderList = await findHolderList(oystehr);

  if (!holderList) {
    throw new Error('Global templates holder list not found — this should never happen');
  }

  if (!holderList.entry?.length) {
    return { templates: [] };
  }

  // Get all template IDs from the holder list entries (deduplicated)
  const templateIds = [
    ...new Set(
      holderList.entry.map((entry) => entry.item.reference?.replace('List/', '')).filter((id): id is string => !!id)
    ),
  ];

  if (templateIds.length === 0) {
    return { templates: [] };
  }

  // Fetch all template Lists by their IDs in parallel groups of 50
  const idChunks = chunkThings(templateIds, 50);
  const chunkResults = await Promise.all(
    idChunks.map((chunk) =>
      oystehr.fhir
        .search<List>({
          resourceType: 'List',
          params: [
            { name: '_id', value: chunk.join(',') },
            { name: '_count', value: '50' },
          ],
        })
        .then((result) => result.unbundle())
    )
  );
  const filteredTemplates = chunkResults.flat();

  const codeSystem = GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM;
  const examTypeConfig = examConfig.default;
  const knownExamFields = collectKnownExamFields(examTypeConfig.components);
  const knownRosFields = collectKnownRosFields();

  // Filter to templates matching the requested exam type code system
  const examTypeTemplates = filteredTemplates.filter(
    (template) => template.code?.coding?.some((c) => c.system === codeSystem)
  );

  const examTagSystem = chartDataTagSystem('exam-observation-field');
  const rosTagSystem = chartDataTagSystem('ros-observation-field');
  const legacyRosTagSystem = chartDataTagSystem('ros');

  const templateInfos: TemplateInfo[] = examTypeTemplates
    .map((template) => {
      const coding = template.code?.coding?.find((c) => c.system === codeSystem);
      const examVersion = coding?.version ?? '';

      let versionData: TemplateVersionData | undefined;

      if (includeVersionData) {
        const contained = (template.contained || []) as Resource[];

        const { isCurrentVersion, unmatchedExamFields, unmatchedRosFields, rosNote } = analyzeTemplateVersionData({
          contained,
          examTagSystem,
          rosTagSystem,
          legacyRosTagSystem,
          knownExamFields,
          knownRosFields,
        });

        if (isCurrentVersion) {
          versionData = { isCurrentVersion };
        } else {
          versionData = {
            isCurrentVersion,
            unmatchedFields: {
              exam: unmatchedExamFields,
              ros: unmatchedRosFields,
              legacyRosContained: rosNote !== null,
            },
          };
        }
      }

      return {
        id: template.id!,
        title: template.title ?? '',
        examVersion,
        versionData,
      };
    })
    .filter((info) => info.title !== '');

  templateInfos.sort((a, b) => a.title.localeCompare(b.title));

  return { templates: templateInfos };
};
