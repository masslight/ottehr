import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient, Questionnaire, QuestionnaireResponse, Slot, ValueSet } from 'fhir/r4b';
import {
  BOOKING_CONFIG,
  FHIR_RESOURCE_NOT_FOUND,
  GetBookingQuestionnaireParams,
  GetBookingQuestionnaireParamsSchema,
  GetBookingQuestionnaireResponse,
  getSecret,
  getServiceCategoryFromSlot,
  getServiceModeFromSlot,
  INVALID_INPUT_ERROR,
  mapQuestionnaireAndValueSetsToItemsList,
  MISSING_REQUEST_BODY,
  prepopulateBookingForm,
  Secrets,
  SecretsKeys,
  selectBookingQuestionnaire,
  ServiceCategoryCode,
  ServiceMode,
} from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { getUser, userHasAccessToPatient } from '../../../shared/auth';

const ZAMBDA_NAME = 'get-booking-questionnaire';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    const validatedParams = validatedParameters;
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParams;

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    const effectInput = await complexValidation(validatedParams, oystehr);

    console.time('perform-effect');
    const response = await performEffect(effectInput);
    console.timeEnd('perform-effect');

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (input: EffectInput): Promise<GetBookingQuestionnaireResponse> => {
  const { patient, questionnaire, serviceCategoryCode, serviceMode } = input;
  const items = questionnaire.item || [];

  // todo: derive the value sets needed by examining the questionnaire items
  // it happens that we don't use any value sets in Qs right now
  const valueSets: ValueSet[] = [];
  const allItems = mapQuestionnaireAndValueSetsToItemsList(items, valueSets);

  const prepopulatedItem = prepopulateBookingForm({
    questionnaire,
    context: {
      serviceMode,
      serviceCategoryCode,
    },
    patient,
  });

  console.log('prepopulatedItem', JSON.stringify(prepopulatedItem, null, 2));

  const questionnaireResponse: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    status: 'in-progress',
    subject: patient ? { reference: `Patient/${patient.id}` } : undefined,
    item: prepopulatedItem,
  };
  if (patient) {
    console.log('todo: prefill a QR for the patient');
  }

  return {
    allItems,
    questionnaireResponse,
    title: questionnaire.title,
  };
};

enum Access_Level {
  anonymous,
  full,
}
interface AccessValidationInput {
  oystehr: Oystehr;
  user?: User;
  appointmentPatient: Patient;
}
const validateUserAccess = async (input: AccessValidationInput): Promise<Access_Level> => {
  const { oystehr, user, appointmentPatient } = input;
  if (user && appointmentPatient.id) {
    const hasAccess = await userHasAccessToPatient(user, appointmentPatient.id, oystehr);
    if (hasAccess) {
      return Access_Level.full;
    } else {
      return Access_Level.anonymous;
    }
  }
  return Access_Level.anonymous;
};

type ValidatedInput = GetBookingQuestionnaireParams & { secrets: Secrets | null; userToken: string | null };
const validateRequestParameters = (input: ZambdaInput): ValidatedInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  let parsed: GetBookingQuestionnaireParams;
  try {
    parsed = GetBookingQuestionnaireParamsSchema.parse(JSON.parse(input.body));
  } catch (e: any) {
    throw INVALID_INPUT_ERROR(e.message);
  }

  const authorization = input.headers.Authorization?.replace('Bearer ', '');

  return {
    ...parsed,
    secrets: input.secrets ?? null,
    userToken: authorization ?? null,
  };
};

interface EffectInput {
  serviceMode: ServiceMode;
  serviceCategoryCode: ServiceCategoryCode;
  questionnaire: Questionnaire;
  patient?: Patient;
}

const complexValidation = async (input: ValidatedInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { patientId, slotId, userToken, secrets } = input;

  const slot = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: slotId });
  if (!slot) {
    throw FHIR_RESOURCE_NOT_FOUND('Slot');
  }

  const serviceMode = getServiceModeFromSlot(slot);
  const serviceCategoryCode = getServiceCategoryFromSlot(slot) ?? BOOKING_CONFIG.serviceCategories[0].code;

  if (!serviceMode) {
    // this indicates something is misconfigured in the slot or schedule
    throw new Error('Could not determine service mode from slot');
  }

  const { templateQuestionnaire } = selectBookingQuestionnaire(slot);

  if (!templateQuestionnaire) {
    throw INVALID_INPUT_ERROR(
      'A canonical URL could not be resolved from the provided slotId. Check system configuration.'
    );
  }

  let patient: Patient | undefined;
  if (patientId) {
    patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
  }

  if (!userToken) {
    patient = undefined;
  }

  if (userToken && patient) {
    console.log('getting user');
    const user = await getUser(userToken, secrets);

    // If it's a returning patient, check if the user has
    // access to the patient
    const accessLevel = await validateUserAccess({
      oystehr: oystehr,
      user,
      appointmentPatient: patient,
    });
    if (accessLevel === Access_Level.anonymous) {
      patient = undefined;
    }
  }

  return {
    serviceCategoryCode,
    serviceMode,
    patient,
    questionnaire: templateQuestionnaire,
  };
};
