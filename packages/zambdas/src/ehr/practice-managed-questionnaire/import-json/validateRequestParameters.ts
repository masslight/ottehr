import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import { JSON_IMPORT_QUESTIONNAIRE_TAG, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { slugify } from 'utils/lib/helpers/slugify';
import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { getUserToken } from '../../../shared/auth';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

const ImportJsonQuestionnaireItemSchema = z
  .object({
    linkId: z.string().min(1, 'every item must have a linkId'),
    type: z.string().min(1, 'every item must have a type'),
  })
  .passthrough();

// intentionally looser than PracticeManagedQuestionnaireSchema: imported questionnaires are never edited with the
// questionnaire builder, so they are not restricted to the item types / fields the builder knows how to render
const ImportJsonQuestionnaireSchema = z
  .object({
    resourceType: z.literal('Questionnaire'),
    url: z.string().url('url must be a valid url'),
    title: z.string().min(1, 'title is required'),
    name: z.string().min(1).optional(),
    version: z.string().regex(SEMVER_REGEX, 'version must be in the format major.minor.patch (e.g. 1.0.0)').optional(),
    status: z.enum(['draft', 'active', 'unknown']).optional(),
    item: z.array(ImportJsonQuestionnaireItemSchema).min(1, 'questionnaire must have at least one item'),
  })
  .passthrough();

const ImportJsonInputSchema = z.object({
  questionnaire: z.unknown(),
  questionnaireId: z.string().uuid().optional(),
});

type ValidatedRequest = {
  secrets: Secrets | null;
  userToken: string;
  questionnaire: Questionnaire;
  // when present the json is being uploaded as a new version of this questionnaire
  questionnaireId: string | undefined;
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

  const parsed = safeValidate(ImportJsonQuestionnaireSchema, rawQuestionnaire);
  const questionnaire = parsed as unknown as Questionnaire;

  validateUniqueLinkIds(questionnaire.item ?? []);

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
