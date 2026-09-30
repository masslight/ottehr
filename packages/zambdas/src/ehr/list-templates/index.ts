import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Condition, Encounter, List, Resource } from 'fhir/r4b';
import { collectKnownExamFields } from 'utils/lib/config-helpers/exam-observations';
import { chunkThings } from 'utils/lib/fhir/chat';
import { chartDataTagSystem, GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { examConfig } from 'utils/lib/ottehr-config/examination';
import { collectKnownRosFields } from 'utils/lib/ottehr-config/review-of-systems';
import {
  ListTemplatesZambdaInput,
  ListTemplatesZambdaOutput,
  TemplateDiagnosis,
  TemplateInfo,
  TemplateVersionData,
} from 'utils/lib/types/data/list-template.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { analyzeTemplateVersionData, findHolderList, isDiagnosisCondition } from '../shared/template-helpers';
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

/** Exported so Easy Chart can read the list server-side without an HTTP round trip. */
export const performEffect = async (
  validatedInput: ListTemplatesZambdaInput,
  oystehr: Oystehr
): Promise<ListTemplatesZambdaOutput> => {
  const { includeVersionData, includeDiagnoses } = validatedInput;

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
        ...(includeDiagnoses ? { diagnoses: templateDiagnoses(template) } : {}),
      };
    })
    .filter((info) => info.title !== '');

  templateInfos.sort((a, b) => a.title.localeCompare(b.title));

  return { templates: templateInfos };
};

/** The diagnoses a template charts, ordered by the rank the template was saved with (primary first). */
function templateDiagnoses(template: List): TemplateDiagnosis[] {
  const contained = (template.contained ?? []) as Resource[];
  const encounter = contained.find((resource): resource is Encounter => resource.resourceType === 'Encounter');
  const rankById = new Map(
    (encounter?.diagnosis ?? []).map((diagnosis) => [
      diagnosis.condition.reference?.split('/').pop()?.replace('#', ''),
      diagnosis.rank ?? Number.MAX_SAFE_INTEGER,
    ])
  );
  const rank = (id: string | undefined): number => rankById.get(id) ?? Number.MAX_SAFE_INTEGER;
  return contained
    .filter((resource): resource is Condition => isDiagnosisCondition(resource))
    .flatMap((condition) => {
      const coding = condition.code?.coding?.find((candidate) => candidate.code && candidate.display);
      return coding?.code && coding.display ? [{ id: condition.id, code: coding.code, display: coding.display }] : [];
    })
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map(({ code, display }) => ({ code, display }));
}
