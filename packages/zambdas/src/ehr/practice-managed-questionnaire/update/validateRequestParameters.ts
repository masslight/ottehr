import Oystehr from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import {
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PracticeManagedQuestionnaireSchema,
  PracticeManagedQuestionnaireUpdateInput,
  PracticeManagedQuestionnaireUpdateStatusSchema,
  Secrets,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../../shared';
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

  let questionnaireId: string | undefined;

  if (updateType === 'update-status') {
    questionnaireId = data.questionnaireId;
  } else {
    questionnaireId = data.id;
  }

  const questionnaire = await oystehr.fhir.get<Questionnaire>({
    resourceType: 'Questionnaire',
    id: questionnaireId ?? '',
  });

  if (!questionnaire) throw INVALID_INPUT_ERROR(`Could not get Questionnaire/${questionnaireId}`);

  validateQisPracticeManaged(questionnaire, questionnaireId ?? '');
};
