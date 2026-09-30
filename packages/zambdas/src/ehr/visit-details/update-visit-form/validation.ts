import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { UpdateVisitFormInput } from 'utils/lib/types/api/update-visit-details.types';
import {
  FHIR_RESOURCE_NOT_FOUND,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
} from 'utils/lib/types/errors';
import z from 'zod';
import { checkIsEHRUser, getUser, isTestUser, userHasAccessToPatient } from '../../../shared/auth';
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
  const isEHRUser = user && checkIsEHRUser(user);
  const userAccess = await userHasAccessToPatient(user, patientId, oystehr);
  if (!user || (!userAccess && !isEHRUser && !isTestUser(user))) {
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
  }

  let questionnaireResponse: QuestionnaireResponse | undefined;
  try {
    questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });
  } catch {
    throw FHIR_RESOURCE_NOT_FOUND('QuestionnaireResponse');
  }

  if (!questionnaireResponse?.id) {
    throw FHIR_RESOURCE_NOT_FOUND('QuestionnaireResponse');
  }

  if (questionnaireResponse.subject?.reference !== `Patient/${patientId}`) {
    throw INVALID_INPUT_ERROR(
      `The provided patient ID does not match the patient associated with the questionnaire response.`
    );
  }

  if (questionnaireResponse.status === 'entered-in-error') {
    throw INVALID_INPUT_ERROR(`A form that has been deleted cannot be edited.`);
  }

  return { ...input, questionnaireResponse };
}
