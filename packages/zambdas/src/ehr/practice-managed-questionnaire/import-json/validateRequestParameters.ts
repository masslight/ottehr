import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import { JSON_IMPORT_QUESTIONNAIRE_TAG, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { collectCalculatedExpressionIssues } from 'utils/lib/helpers/paperwork/calculated-expressions';
import { slugify } from 'utils/lib/helpers/slugify';
import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { getUserToken } from '../../../shared/auth';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

type ImportJsonQuestionnaireItem = {
  linkId: string;
  type: string;
  item?: ImportJsonQuestionnaireItem[];
  [key: string]: unknown;
};

// recursive so nested items (e.g. children of group items) are also required to have a linkId and type
const ImportJsonQuestionnaireItemSchema: z.ZodType<ImportJsonQuestionnaireItem> = z.lazy(() =>
  z
    .object({
      linkId: z.string({ required_error: 'Each item must have a linkId' }).min(1, 'Each item must have a linkId'),
      type: z.string({ required_error: 'Each item must have a type' }).min(1, 'Each item must have a type'),
      item: z.array(ImportJsonQuestionnaireItemSchema).optional(),
    })
    .passthrough()
);

// intentionally looser than PracticeManagedQuestionnaireSchema: imported questionnaires are never edited with the
// questionnaire builder, so they are not restricted to the item types / fields the builder knows how to render
const ImportJsonQuestionnaireSchema = z
  .object({
    resourceType: z.literal('Questionnaire', {
      errorMap: () => ({ message: 'resourceType must be "Questionnaire"' }),
    }),
    url: z.string({ required_error: 'url is required' }).url('url must be a valid url'),
    title: z.string({ required_error: 'title is required' }).min(1, 'title is required'),
    name: z.string().min(1).optional(),
    version: z.string().regex(SEMVER_REGEX, 'version must be in the format major.minor.patch (e.g. 1.0.0)').optional(),
    status: z.enum(['draft', 'active', 'unknown']).optional(),
    item: z
      .array(ImportJsonQuestionnaireItemSchema, { required_error: 'questionnaire must have at least one item' })
      .min(1, 'questionnaire must have at least one item'),
  })
  .passthrough();

const ImportJsonInputSchema = z.object({
  questionnaire: z.unknown(),
  questionnaireId: z.string().uuid().optional(),
});

export type ValidatedRequest = {
  secrets: Secrets | null;
  userToken: string;
  questionnaire: Questionnaire;
  questionnaireId: string | undefined; // included if upload happens on detail page
};

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = getUserToken(input);

  const { questionnaire: rawQuestionnaire, questionnaireId } = safeValidate(
    ImportJsonInputSchema,
    safeJsonParse(input.body)
  );

  if (!rawQuestionnaire || typeof rawQuestionnaire !== 'object') {
    throw INVALID_INPUT_ERROR('questionnaire must be a json object');
  }

  // not using safeValidate here: its message includes the zod path (e.g. item[0].item[0].linkId), which is noisy
  // for users, so surface just the first issue's message instead
  const parsed = ImportJsonQuestionnaireSchema.safeParse(rawQuestionnaire);
  if (!parsed.success) {
    console.error('[Validation Error]', parsed.error.issues);
    throw INVALID_INPUT_ERROR(parsed.error.issues[0]?.message ?? 'questionnaire is invalid');
  }
  const questionnaire = parsed.data as unknown as Questionnaire;

  validateUniqueLinkIds(questionnaire.item ?? []);
  validateCalculatedExpressions(questionnaire.item ?? []);

  return {
    secrets: input.secrets,
    userToken,
    questionnaire: prepareImportedQuestionnaire(questionnaire),
    questionnaireId,
  };
}

// linkIds are how QuestionnaireResponse answers map back to their questions, so they must be unique across all items
function validateUniqueLinkIds(items: QuestionnaireItem[], seen = new Set<string>()): void {
  for (const item of items) {
    if (seen.has(item.linkId)) {
      throw INVALID_INPUT_ERROR(`linkId must be unique, duplicate found: ${item.linkId}`);
    }
    seen.add(item.linkId);
    if (item.item) validateUniqueLinkIds(item.item, seen);
  }
}

// every problem with the calculated items is reported at once, so the questionnaire can be fixed in a single pass
function validateCalculatedExpressions(items: QuestionnaireItem[]): void {
  const issues = collectCalculatedExpressionIssues(items);
  if (issues.length > 0) {
    throw INVALID_INPUT_ERROR(
      `The questionnaire has ${issues.length} problem${
        issues.length === 1 ? '' : 's'
      } with its calculated items:\n${issues.map((issue) => `- ${issue}`).join('\n')}`
    );
  }
}

// server managed fields (id, meta other than tags) are dropped and the practice managed + json import tags are applied
function prepareImportedQuestionnaire(questionnaire: Questionnaire): Questionnaire {
  const { id: _id, meta, ...rest } = questionnaire;

  const managedTags = [PRACTICE_MANAGED_QUESTIONNAIRE_TAG, JSON_IMPORT_QUESTIONNAIRE_TAG];
  const otherTags = (meta?.tag ?? []).filter(
    (tag) => !managedTags.some((managed) => managed.system === tag.system && managed.code === tag.code)
  );

  return {
    ...rest,
    name: rest.name ?? slugify(rest.title ?? 'form', { maxLength: 60 }),
    meta: { tag: [...otherTags, ...managedTags] },
  };
}
