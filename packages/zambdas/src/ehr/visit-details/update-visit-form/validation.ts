import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import {
  deconstructCanonicalUrl,
  getCanonicalQuestionnaire,
  getQuestionnaireForQR,
} from 'utils/lib/fhir/questionnaires';
import { isPracticeManagedQ } from 'utils/lib/helpers/practice-managed-questionnaires';
import { Secrets } from 'utils/lib/secrets';
import { UpdateVisitFormInput } from 'utils/lib/types/api/update-visit-details.types';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  NOT_AUTHORIZED,
} from 'utils/lib/types/errors';
import z from 'zod';
import { checkIsEHRUser, getUser, isTestUser } from '../../../shared/auth';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

export interface ValidatedInput {
  body: UpdateVisitFormInput;
  callerAccessToken: string;
}

export interface EffectInput extends ValidatedInput {
  questionnaireResponse: QuestionnaireResponse;
}

export function validateSecrets(secrets: Secrets | null): Secrets {
  if (!secrets) {
    throw new Error('Secrets are required.');
  }

  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_API, ENVIRONMENT } = secrets;
  if (
    !AUTH0_ENDPOINT ||
    !AUTH0_CLIENT ||
    !AUTH0_SECRET ||
    !AUTH0_AUDIENCE ||
    !FHIR_API ||
    !PROJECT_API ||
    !ENVIRONMENT
  ) {
    throw new Error('Missing required secrets');
  }
  return {
    AUTH0_ENDPOINT,
    AUTH0_CLIENT,
    AUTH0_SECRET,
    AUTH0_AUDIENCE,
    FHIR_API,
    PROJECT_API,
    ENVIRONMENT,
  };
}

const QuestionnaireResponseItemSchema: z.ZodType<{ linkId: string; item?: unknown[]; answer?: unknown[] }> = z.lazy(
  () =>
    z.object({
      linkId: z.string().min(1, '"linkId" must not be empty.'),
      text: z.string().optional(),
      answer: z.array(z.unknown()).optional(),
      item: z.array(QuestionnaireResponseItemSchema).optional(),
    })
);

const UpdateVisitFormInputSchema = z.object({
  questionnaireResponseId: z.string().uuid('"questionnaireResponseId" must be a valid UUID.'),
  patientId: z.string().uuid('"patientId" must be a valid UUID.'),
  pages: z.array(QuestionnaireResponseItemSchema).min(1, '"pages" must contain at least one page.'),
});

export function validateRequestParameters(input: ZambdaInput): ValidatedInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const validationResult = UpdateVisitFormInputSchema.safeParse(safeJsonParse(input.body));

  if (!validationResult.success) {
    const errors = validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw INVALID_INPUT_ERROR(errors);
  }

  const token = input.headers.Authorization.replace('Bearer ', '');
  if (!token.trim()) {
    throw INVALID_INPUT_ERROR(`Authorization token is required in the header.`);
  }

  return {
    body: validationResult.data as UpdateVisitFormInput,
    callerAccessToken: token,
  };
}

export async function complexValidation(
  input: ValidatedInput,
  secrets: Secrets,
  oystehr: Oystehr
): Promise<EffectInput> {
  const { questionnaireResponseId, patientId } = input.body;
  const { callerAccessToken } = input;

  const user = await getUser(callerAccessToken, secrets);
  if (!user || (!checkIsEHRUser(user) && !isTestUser(user))) {
    throw NOT_AUTHORIZED;
  }

  let questionnaireResponse: QuestionnaireResponse | undefined;
  try {
    questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });
  } catch {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`QuestionnaireResponse/${questionnaireResponseId} could not be found.`);
  }

  if (!questionnaireResponse?.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`QuestionnaireResponse/${questionnaireResponseId} could not be found.`);
  }

  if (questionnaireResponse.subject?.reference !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR(
      `QuestionnaireResponse/${questionnaireResponseId} belongs to ${
        questionnaireResponse.subject?.reference ?? 'no patient'
      }, not Patient/${patientId}.`
    );
  }

  if (questionnaireResponse.status === 'entered-in-error') {
    throw INVALID_INPUT_ERROR(`A form that has been deleted cannot be edited.`);
  }

  const editablePageLinkIds = await getEditablePageLinkIds(questionnaireResponse, oystehr);
  const forbiddenPage = input.body.pages.find((page) => !editablePageLinkIds.has(page.linkId));
  if (forbiddenPage) {
    throw INVALID_INPUT_ERROR(`Page "${forbiddenPage.linkId}" does not belong to an editable form on this response.`);
  }

  return { ...input, questionnaireResponse };
}

async function getEditablePageLinkIds(
  questionnaireResponse: QuestionnaireResponse,
  oystehr: Oystehr
): Promise<Set<string>> {
  const questionnaire = await getQuestionnaireForQR(questionnaireResponse, oystehr);
  const flowMembers = questionnaire.derivedFrom ?? [];

  if (flowMembers.length === 0) {
    return new Set((questionnaire.item ?? []).map((page) => page.linkId));
  }

  const derived = await Promise.all(
    flowMembers.map((canonical) => {
      const { url, version } = deconstructCanonicalUrl(canonical, questionnaire);
      return getCanonicalQuestionnaire({ url, version }, oystehr);
    })
  );

  return new Set(derived.filter(isPracticeManagedQ).flatMap((form) => (form.item ?? []).map((page) => page.linkId)));
}
