import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Encounter,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import {
  DOB_UNCONFIRMED_ERROR,
  extractHealthcareServiceAndSupportingLocations,
  getLastUpdateTimestampForResource,
  getQuestionnaireAndValueSets,
  HealthcareServiceWithLocationContext,
  isNonPaperworkQuestionnaireResponse,
  mapQuestionnaireAndValueSetsToItemsList,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  PaperworkSupportingInfo,
  Secrets,
  UCGetPaperworkResponse,
} from 'utils';
import { createOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../../shared';
import { getUser, userHasAccessToPatient } from '../../../shared/auth';
import { formatPatientSexForPaperwork, getPaperworkSupportingInfoForUserWithAccess } from '../sharedHelpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetPaperworkInput {
  appointmentID: string;
  dateOfBirth?: string;
  secrets: Secrets | null;
  authorization: string | undefined;
}

export type FullAccessPaperworkSupportingInfo = Omit<PaperworkSupportingInfo, 'patient'> & {
  patient: {
    id: string | undefined;
    firstName: string | undefined;
    middleName: string | undefined;
    lastName: string | undefined;
    dateOfBirth: string | undefined;
    sex: string | undefined;
  };
  updateTimestamp: number | undefined;
};

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler('get-paperwork', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { appointmentID, dateOfBirth, secrets, authorization } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(secrets);
  } else {
    console.log('already have token');
  }

  const oystehr = createOystehrClient(oystehrToken, secrets);
  // const z3Client = createZ3Client(oystehrToken, secrets);
  // const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);

  let appointment: Appointment | undefined = undefined;
  let location: Location | undefined = undefined;
  let hsResources: HealthcareServiceWithLocationContext | undefined = undefined;
  let practitioner: Practitioner | undefined;

  // only prebooked appointments will have an appointment id (is this true??)
  console.log(`getting appointment, encounter, location, and patient resources for appointment id ${appointmentID}`);
  console.time('get-appointment-encounter-location-patient');
  const baseCategoryResources = (
    await oystehr.fhir.search<
      Appointment | Encounter | Location | HealthcareService | Patient | QuestionnaireResponse | Practitioner
    >({
      resourceType: 'Encounter',
      params: [
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: 'appointment',
          value: `${appointmentID}`,
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
          name: '_revinclude',
          value: 'QuestionnaireResponse:encounter',
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
  )
    .unbundle()
    .filter((resource) => isNonPaperworkQuestionnaireResponse(resource) === false);

  // parse retrieved resources
  appointment = baseCategoryResources.find((resource) => {
    return resource.resourceType == 'Appointment';
  }) as Appointment;
  const encounters = baseCategoryResources.filter((resource) => {
    return resource.resourceType == 'Encounter';
  }) as Encounter[];
  const encounter = encounters?.[0];
  hsResources = extractHealthcareServiceAndSupportingLocations(baseCategoryResources);
  const fhirPatient = baseCategoryResources.find((resource) => {
    return resource.resourceType == 'Patient';
  }) as Patient;
  if (hsResources === undefined) {
    location = baseCategoryResources.find((resource) => {
      return resource.resourceType == 'Location';
    }) as Location;
    practitioner = baseCategoryResources.find((resource) => {
      return resource.resourceType == 'Practitioner';
    }) as Practitioner;
  }
  const questionnaireResponseResource: QuestionnaireResponse = baseCategoryResources.find((resource) => {
    return resource.resourceType == 'QuestionnaireResponse';
  }) as QuestionnaireResponse;

  const missingResources: string[] = [];
  if (!appointment) {
    missingResources.push('Appointment');
  }
  if (!encounter) {
    missingResources.push('Encounter');
  }
  if (!location && !hsResources && !practitioner) {
    missingResources.push('Location');
  }
  if (!fhirPatient) {
    missingResources.push('Patient');
  }
  if (!questionnaireResponseResource) {
    missingResources.push('QuestionnaireResponse');
  }

  if (missingResources.length) {
    throw new Error(`missing the following base category resources: ${missingResources.join(', ')}`);
  }

  if (!encounter.id) {
    throw new Error('Encounter ID is undefined');
  }
  if (!fhirPatient.id) {
    throw new Error('FHIR Patient ID is undefined');
  }
  console.log('base category resources found');
  console.timeEnd('get-appointment-encounter-location-patient');

  const [sourceQuestionnaireUrl, sourceQuestionnaireVersion] = questionnaireResponseResource.questionnaire?.split(
    '|'
  ) ?? [null, null];

  const urlForQFetch = sourceQuestionnaireUrl;
  const versionForQFetch = sourceQuestionnaireVersion;
  if (!urlForQFetch || !versionForQFetch) {
    throw new Error(`Questionnaire for QR is not well defined: ${urlForQFetch}|${versionForQFetch}`);
  }
  console.log('currentQuestionnaireUrl1', urlForQFetch);

  console.time('get-booking-questionnaire');
  // todo: _revinclude:iterate in the main query to get the questionnaire along with the other main resources
  // this is not currently possible due to an Oystehr bug
  // value sets probably still need to be fetched up separately
  const { questionnaire, valueSets } = await getQuestionnaireAndValueSets(
    urlForQFetch,
    versionForQFetch,
    'ip-questionnaire-item-value-set',
    oystehr
  );
  console.timeEnd('get-booking-questionnaire');

  if (!questionnaire.item) {
    questionnaire.item = [];
  }
  const allItems = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item, valueSets);

  console.log('checking user access to patient');
  console.time('check-user-access');
  let accessLevel: Access_Level;
  if (authorization) {
    console.log('getting user');
    const user = await getUser(authorization.replace('Bearer ', ''), secrets);

    // If it's a returning patient, check if the user has
    // access to the patient and the appointment.
    accessLevel = await validateUserAccess({
      oystehr: oystehr,
      user,
      suppliedDOB: dateOfBirth,
      appointmentPatient: fhirPatient,
    });
  } else {
    accessLevel = await validateUserAccess({
      oystehr: oystehr,
      user: undefined,
      suppliedDOB: dateOfBirth,
      appointmentPatient: fhirPatient,
    });
  }
  console.timeEnd('check-user-access');

  // Get paperwork for authorized user
  console.log('checking user authorization');
  if (accessLevel === Access_Level.full) {
    console.log('User is authorized to access paperwork');
    console.log('building paperwork questions');
    // Get partial paperwork data - everything but questionnaire, responses
    const partialAppointment = getPaperworkSupportingInfoForUserWithAccess({
      appointment,
      patient: fhirPatient,
      location,
      hsResources,
      practitioner,
      encounter,
    });

    console.log('building get paperwork response');
    const updateTimestamp = getLastUpdateTimestampForResource(questionnaireResponseResource);

    // console.log('qrResponse item', JSON.stringify(questionnaireResponseResource.item));

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
      questionnaireResponse: questionnaireResponseResource,
    };
    // console.log('returning response: ', JSON.stringify(response));
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } else {
    console.log('User has anonymous access only to this paperwork');
    // Get partial paperwork data - everything but questionnaire responses
    const { appointment: app, patient } = getPaperworkSupportingInfoForUserWithAccess({
      appointment,
      patient: fhirPatient,
      location,
      hsResources,
      practitioner,
      encounter,
    });
    const response = {
      appointment: app,
      patient: {
        firstName: patient.firstName,
      },
      allItems: [],
    };
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
});

enum Access_Level {
  anonymous,
  full,
}
interface AccessValidationInput {
  oystehr: Oystehr;
  user?: User;
  suppliedDOB?: string;
  appointmentPatient: Patient;
}
const validateUserAccess = async (input: AccessValidationInput): Promise<Access_Level> => {
  const { oystehr, user, suppliedDOB, appointmentPatient } = input;
  const dobMatch = suppliedDOB && suppliedDOB === appointmentPatient.birthDate;

  if (!user && !suppliedDOB) {
    return Access_Level.anonymous;
  }

  if (user && appointmentPatient.id) {
    const hasAccess = await userHasAccessToPatient(user, appointmentPatient.id, oystehr);
    if (hasAccess) {
      return Access_Level.full;
    } else if (!dobMatch) {
      throw NO_READ_ACCESS_TO_PATIENT_ERROR;
    }
  }

  if (dobMatch) {
    return Access_Level.full;
  } else {
    throw DOB_UNCONFIRMED_ERROR;
  }
};
