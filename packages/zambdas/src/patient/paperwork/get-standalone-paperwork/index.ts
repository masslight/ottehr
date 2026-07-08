import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Encounter,
  FhirResource,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import {
  extractHealthcareServiceAndSupportingLocations,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getLastUpdateTimestampForResource,
  getQuestionnaireViaUrlFromQR,
  MANAGED_QUESTIONNAIRE_ERROR,
  mapQuestionnaireAndValueSetsToItemsList,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  UCGetPaperworkResponse,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getUser,
  userHasAccessToPatient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import {
  formatPatientSexForPaperwork,
  getPaperworkSupportingInfoForUserWithAccess,
  GetPaperworkSupportingInfoInput,
} from '../sharedHelpers';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'get-standalone-paperwork';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);

  const validatedParameters = validateRequestParameters(input);

  const { questionnaireResponseId, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }

  const oystehr = createOystehrClient(oystehrToken, secrets);

  const questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    id: questionnaireResponseId,
  });
  const subjectRef = questionnaireResponse.subject?.reference;
  if (!subjectRef?.startsWith('Patient/')) {
    throw new Error(`Unexpected subject on QuestionnaireResponse/${questionnaireResponseId}`);
  }

  const patientId = subjectRef.replace('Patient/', '');

  // Authorization: the caller must be connected to the patient (or be an EHR user —
  // userHasAccessToPatient allows those implicitly). Without this, any authenticated
  // account could read another patient's forms AND their QuestionnaireResponse answers
  // by guessing/replaying an appointment id.
  const callerToken = input.headers?.Authorization?.replace('Bearer ', '');
  const caller = callerToken ? await getUser(callerToken, input.secrets).catch(() => undefined) : undefined;
  const hasAccess = caller ? await userHasAccessToPatient(caller, patientId, oystehr) : false;
  console.log('hasAccess', hasAccess);
  if (!hasAccess) {
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
  }

  console.log(`getting related questionnaire for QuestionnaireResponse/${questionnaireResponseId}`);
  const questionnaire = await getQuestionnaireViaUrlFromQR(questionnaireResponse, oystehr);

  const isManaged = hasTag(questionnaire, PRACTICE_MANAGED_QUESTIONNAIRE_TAG);
  if (!isManaged) {
    // this would be a weird edge case where we got an id for a non managed questionnaire response
    console.log(`questionnaire is not managed, Questionnaire/${questionnaire.id}`);
    throw MANAGED_QUESTIONNAIRE_ERROR(
      `This form is not compatible with the standalone form path: QuestionnaireResponse/${questionnaireResponseId}`
    );
  }

  const allItems = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);

  const resources = await getResources(oystehr, questionnaireResponse);
  const partialAppointment = getPaperworkSupportingInfoForUserWithAccess(resources);

  const updateTimestamp = getLastUpdateTimestampForResource(questionnaireResponse);

  const { patient: fhirPatient } = resources;

  // we may not necessarily need all of these data points for standalone forms as it exists today
  // however in the spirit of keeping work flows as consolidated as possible we will return it in the same shape as get-paperwork
  const response: UCGetPaperworkResponse = {
    ...partialAppointment,
    updateTimestamp,
    patient: {
      id: fhirPatient.id,
      firstName: fhirPatient.name?.[0].given?.[0],
      middleName: fhirPatient.name?.[0].given?.[1],
      lastName: fhirPatient.name?.[0].family,
      dateOfBirth: fhirPatient.birthDate,
      sex: formatPatientSexForPaperwork(fhirPatient.gender || ''),
    },
    allItems,
    questionnaireResponse: questionnaireResponse,
    questionnaireTitle: questionnaire.title,
  };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

type ResourceConfig = {
  patient: Patient | undefined;
  encounter: Encounter | undefined;
  appointment: Appointment | undefined;
  location: Location | undefined;
  practitioner: Practitioner | undefined;
};

const getResources = async (
  oystehr: Oystehr,
  questionnaireResponse: QuestionnaireResponse
): Promise<GetPaperworkSupportingInfoInput> => {
  const encounterId = questionnaireResponse.encounter?.reference?.replace('Encounter/', '');

  if (!encounterId) {
    throw new Error(`No encounter on QuestionnaireResponse/${questionnaireResponse.id}`);
  }

  console.log('searching for additional resources');

  const baseCategoryResources = (
    await oystehr.fhir.search<Appointment | Encounter | Location | HealthcareService | Patient | Practitioner>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:actor:HealthcareService',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:actor:Practitioner',
        },
        {
          name: '_include',
          value: 'Encounter:patient',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:slot',
        },
        {
          name: '_include:iterate',
          value: 'Slot:schedule',
        },
      ],
    })
  ).unbundle();

  const hsResources = extractHealthcareServiceAndSupportingLocations(baseCategoryResources);

  const resources = baseCategoryResources.reduce(
    (acc: ResourceConfig, resource) => {
      if (resource.resourceType === 'Patient') acc.patient = resource;
      if (resource.resourceType === 'Encounter') acc.encounter = resource;
      if (resource.resourceType === 'Appointment') acc.appointment = resource;
      if (resource.resourceType === 'Location') acc.location = resource;
      if (resource.resourceType === 'Practitioner') acc.practitioner = resource;
      return acc;
    },
    { patient: undefined, encounter: undefined, appointment: undefined, location: undefined, practitioner: undefined }
  );

  const { appointment, patient, location, practitioner, encounter } = resources;

  if (!encounter) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(errorMessage('encounter', encounterId));
  if (!patient) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(errorMessage('patient', encounterId));
  if (!appointment) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(errorMessage('appointment', encounterId));

  return {
    appointment,
    encounter,
    patient,
    location,
    hsResources,
    practitioner,
  };
};

function hasTag(resource: FhirResource, tag: { system: string; code: string }): boolean {
  const { system, code } = tag;
  return Boolean(resource.meta?.tag?.some((t) => t.code === code && t.system === system));
}

function errorMessage(resource: string, encounterId: string | undefined): string {
  return `No ${resource} found for Encounter/${encounterId}`;
}
