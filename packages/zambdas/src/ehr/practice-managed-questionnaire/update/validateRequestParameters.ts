import Oystehr from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import {
  fhirQuestionnaireToPracticeManaged,
  isPracticeDefaultQ,
} from 'utils/lib/helpers/practice-managed-questionnaires';
import { validateEditsAgainstLocks } from 'utils/lib/helpers/practice-managed-questionnaires/lock-validation';
import { Secrets } from 'utils/lib/secrets';
import {
  PracticeManagedQuestionnaireSchema,
  PracticeManagedQuestionnaireUpdateStatusSchema,
} from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.schema';
import { PracticeManagedQuestionnaireUpdateInput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeValidate } from '../../../shared/validation';
import { validateQisPracticeManaged } from '../helpers';

type BaseContext = {
  secrets: Secrets | null;
};

type ValidatedRequest = BaseContext & PracticeManagedQuestionnaireUpdateInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedRequest {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const secrets = input.secrets;

  let params: PracticeManagedQuestionnaireUpdateInput;
  try {
    params = JSON.parse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Unable to parse request body. Invalid JSON.');
  }

  const { updateType, data } = params;

  const missingParams: string[] = [];

  if (!updateType) missingParams.push('updateType');
  if (!data) missingParams.push('data');
  if (missingParams.length > 0) throw MISSING_REQUIRED_PARAMETERS(missingParams);

  if (updateType === 'update-status') {
    const parsed = data;
    const validatedData = safeValidate(PracticeManagedQuestionnaireUpdateStatusSchema, parsed);

    return {
      updateType,
      data: validatedData,
      secrets,
    };
  } else if (updateType === 'update-questionnaire') {
    const parsed = data;
    const validatedData = safeValidate(PracticeManagedQuestionnaireSchema, parsed);

    if (!validatedData.id) {
      throw INVALID_INPUT_ERROR(`id is missing from the parsed questionnaire`);
    }

    return {
      updateType,
      data: validatedData,
      secrets,
    };
  }

  throw INVALID_INPUT_ERROR(`updateType was an unexpected value: ${updateType}`);
}

export const validateQuestionnaire = async (input: ValidatedRequest, oystehr: Oystehr): Promise<void> => {
  const { updateType, data } = input;

  const questionnaireId = updateType === 'update-status' ? data.questionnaireId : data.id;

  const questionnaire = await oystehr.fhir.get<Questionnaire>({
    resourceType: 'Questionnaire',
    id: questionnaireId ?? '',
  });

  if (!questionnaire) throw INVALID_INPUT_ERROR(`Could not get Questionnaire/${questionnaireId}`);

  validateQisPracticeManaged(questionnaire, questionnaireId ?? '');

  // Extra guards for "default" (locked) questionnaires. The fetched resource is the current stored version
  // (the base): it is non-deletable, and a content edit is validated against the harvest-lock manifest here
  // server-side (anti-tamper — locks are recomputed from the manifest, never trusted from the client).
  if (isPracticeDefaultQ(questionnaire)) {
    if (updateType === 'update-status' && data.newStatus === 'retired') {
      throw INVALID_INPUT_ERROR('Default paperwork questionnaires cannot be deleted.');
    }
    if (updateType === 'update-questionnaire') {
      const base = fhirQuestionnaireToPracticeManaged(questionnaire);
      const violations = validateEditsAgainstLocks(data, base);
      if (violations.length > 0) {
        throw INVALID_INPUT_ERROR(`This edit is not allowed on default paperwork: ${violations.join(' ')}`);
      }
    }
  }
};
