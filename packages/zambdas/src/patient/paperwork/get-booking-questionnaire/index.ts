import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  HealthcareService,
  Patient,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
  Slot,
  ValueSet,
} from 'fhir/r4b';
import {
  BOOKING_CONFIG,
  createAnswerDisplayFilterExtension,
  FHIR_RESOURCE_NOT_FOUND,
  getAllFhirSearchPages,
  GetBookingQuestionnaireParams,
  GetBookingQuestionnaireParamsSchema,
  GetBookingQuestionnaireResponse,
  getServiceCategoryFromSlot,
  getServiceModeFromSlot,
  INVALID_INPUT_ERROR,
  mapQuestionnaireAndValueSetsToItemsList,
  MISSING_REQUEST_BODY,
  parseReasonsForVisit,
  prepopulateBookingForm,
  Secrets,
  selectBookingQuestionnaire,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  ServiceCategoryCode,
  ServiceMode,
} from 'utils';
import { createClinicalOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../../shared';
import { getUser, userHasAccessToPatient } from '../../../shared/auth';

const ZAMBDA_NAME = 'get-booking-questionnaire';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

  const oystehr = createClinicalOystehrClient(oystehrToken, secrets);

  const effectInput = await complexValidation(validatedParams, oystehr);

  console.time('perform-effect');
  const response = await performEffect(effectInput);
  console.timeEnd('perform-effect');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

// Walk the questionnaire item tree (pages → questions → sub-questions) and
// return the first item with the given linkId. The booking Questionnaire
// nests questions one level deep under page items, but recursing keeps this
// robust against future nesting changes.
const findItemByLinkId = (items: QuestionnaireItem[], linkId: string): QuestionnaireItem | undefined => {
  for (const item of items) {
    if (item.linkId === linkId) return item;
    if (item.item) {
      const nested = findItemByLinkId(item.item, linkId);
      if (nested) return nested;
    }
  }
  return undefined;
};

/**
 * Merge the FHIR-backed service category's `reasonsForVisit` into the
 * questionnaire's `reason-for-visit` item so the patient sees the configured
 * options at booking time.
 *
 * Why: the template Questionnaire is built from `BOOKING_CONFIG.serviceCategories`
 * (the compiled-in catalog). Categories registered at runtime via the
 * service-category admin UI live on `HealthcareService.extension` and aren't
 * known to the questionnaire builder. Their RFV options were therefore absent
 * from `answerOption` AND from the `answerDisplayFilters`, so
 * `useDisplayFilteredOptions` on the intake side fell through to "return all
 * options" and the patient saw the compiled-in superset for the wrong category.
 *
 * No-op when the category is in BOOKING_CONFIG (the template already has
 * the right options + filter), when no matching FHIR-backed HealthcareService
 * is found, or when the HS has no `reasonsForVisit` configured.
 */
const enrichFhirBackedRfvOptions = async (params: {
  questionnaire: Questionnaire;
  serviceCategoryCode: ServiceCategoryCode;
  serviceMode: ServiceMode;
  oystehr: Oystehr;
}): Promise<Questionnaire> => {
  const { questionnaire, serviceCategoryCode, serviceMode, oystehr } = params;

  const isCompiledIn = BOOKING_CONFIG.serviceCategories.some((sc) => sc.category.code === serviceCategoryCode);
  if (isCompiledIn) return questionnaire;

  // Paginated: an environment with >1 page of service-category HealthcareServices
  // (FHIR default page size is small) would otherwise silently miss a target
  // category that landed on a later page, and the RFV enrichment would no-op
  // for that booking — the patient would then see the wrong RFV list.
  const allCategoryHses = await getAllFhirSearchPages<HealthcareService>(
    {
      resourceType: 'HealthcareService',
      params: [
        { name: '_tag', value: SERVICE_CATEGORY_TAG.code },
        { name: 'active', value: 'true' },
      ],
    },
    oystehr
  );
  const hs = allCategoryHses.find((r) =>
    (r.type ?? []).some((concept) =>
      (concept.coding ?? []).some((c) => c.system === SERVICE_CATEGORY_SYSTEM && c.code === serviceCategoryCode)
    )
  );
  if (!hs) return questionnaire;

  const reasons = parseReasonsForVisit(hs);
  if (reasons.length === 0) return questionnaire;

  const rfvItem = findItemByLinkId(questionnaire.item ?? [], 'reason-for-visit');
  if (!rfvItem) return questionnaire;

  // Append unseen values to answerOption. The Questionnaire was deep-cloned by
  // `selectBookingQuestionnaire` (JSON.parse/stringify), so in-place mutation
  // is safe and doesn't poison the template for the next caller.
  rfvItem.answerOption = rfvItem.answerOption ?? [];
  const existingValues = new Set(
    rfvItem.answerOption.map((o) => o.valueString).filter((v): v is string => typeof v === 'string')
  );
  for (const r of reasons) {
    if (!existingValues.has(r.value)) {
      existingValues.add(r.value);
      rfvItem.answerOption.push({ valueString: r.value });
    }
  }

  // Add a display filter scoped to this (category, mode) so the intake-side
  // `useDisplayFilteredOptions` narrows the rendered list to just these
  // reasons when the booking matches.
  rfvItem.extension = rfvItem.extension ?? [];
  rfvItem.extension.push(
    createAnswerDisplayFilterExtension(
      [
        { question: 'appointment-service-category', operator: '=', answer: serviceCategoryCode },
        { question: 'appointment-service-mode', operator: '=', answer: serviceMode },
      ],
      Array.from(new Set(reasons.map((r) => r.value)))
    )
  );

  return questionnaire;
};

const performEffect = async (input: EffectInput): Promise<GetBookingQuestionnaireResponse> => {
  const { patient, questionnaire: rawQuestionnaire, serviceCategoryCode, serviceMode, oystehr } = input;

  const questionnaire = await enrichFhirBackedRfvOptions({
    questionnaire: rawQuestionnaire,
    serviceCategoryCode,
    serviceMode,
    oystehr,
  });
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
  oystehr: Oystehr;
}

const complexValidation = async (input: ValidatedInput, oystehr: Oystehr): Promise<EffectInput> => {
  const { patientId, slotId, userToken, secrets } = input;

  const slot = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: slotId });
  if (!slot) {
    throw FHIR_RESOURCE_NOT_FOUND('Slot');
  }

  const serviceMode = getServiceModeFromSlot(slot);
  const serviceCategoryCode = getServiceCategoryFromSlot(slot) ?? BOOKING_CONFIG.serviceCategories[0].category.code;

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
    oystehr,
  };
};
