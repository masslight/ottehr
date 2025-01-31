import Oystehr, { User } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
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
  AppointmentSummary,
  AvailableLocationInformation,
  Closure,
  DOB_UNCONFIRMED_ERROR,
  HealthcareServiceWithLocationContext,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  PaperworkSupportingInfo,
  PersonSex,
  SLUG_SYSTEM,
  ScheduleType,
  ServiceMode,
  UCGetPaperworkResponse,
  VisitType,
  extractHealthcareServiceAndSupportingLocations,
  getLastUpdateTimestampForResource,
  getQuestionnaireAndValueSets,
  getScheduleDetails,
  getUnconfirmedDOBForAppointment,
  mapQuestionnaireAndValueSetsToItemsList,
  serviceModeForHealthcareService,
  userHasAccessToPatient,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, topLevelCatch } from 'zambda-utils';
import '../../../instrument.mjs';
import { getAuth0Token } from '../../shared';
import { getUser } from '../../shared/auth';
import { createOystehrClient, getOtherOfficesForLocation } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetPaperworkInput {
  appointmentID: string;
  dateOfBirth?: string;
  secrets: Secrets | null;
  authorization: string | undefined;
}

// http://localhost:3003/location/ak/anchorage/prebook
// http://localhost:3003/visit/d1040d74-cd91-45f5-b910-7efd6fbcdfbc

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
let zapehrToken: string;
export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, dateOfBirth, secrets, authorization } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);
    // const z3Client = createZ3Client(zapehrToken, secrets);
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
        ],
      })
    ).unbundle();

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

    const [sourceQuestionaireUrl, sourceQuestionnaireVersion] = questionnaireResponseResource.questionnaire?.split(
      '|'
    ) ?? [null, null];

    const urlForQFetch = sourceQuestionaireUrl;
    const versionForQFetch = sourceQuestionnaireVersion;
    if (!urlForQFetch || !versionForQFetch) {
      throw new Error(`Questionnaire for QR is not well defined: ${urlForQFetch}|${versionForQFetch}`);
    }
    console.log('currentQuestionnaireUrl1', urlForQFetch);

    console.time('get-questionnaire');
    // todo: _revinclude:iterate in the main query to get the questionnaire along with the other main resources
    // this is not currently possible due to an Oystehr bug
    // value sets probably still need to be fetched up separately
    const { questionnaire, valueSets } = await getQuestionnaireAndValueSets(
      urlForQFetch,
      versionForQFetch,
      'ip-questionnaire-item-value-set',
      oystehr
    );

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
      });

      console.log('building get paperwork response');
      const updateTimestamp = getLastUpdateTimestampForResource(questionnaireResponseResource);

      // gender must be saved in lower case on the patient resource but the paperwork sex fields consume the value with title case
      const formatPatientSexForPaperwork = (value: string): PersonSex | undefined => {
        const sex = Object.keys(PersonSex).find((key) => PersonSex[key as keyof typeof PersonSex] === value);
        return sex as PersonSex | undefined;
      };

      console.log('qrresponse item', JSON.stringify(questionnaireResponseResource.item));

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
  } catch (error: any) {
    return topLevelCatch('get-paperwork', error, input.secrets);
  }
});

interface GetPaperworkSupportingInfoInput {
  appointment: Appointment;
  patient: Patient;
  location: Location | undefined;
  hsResources: { hs: HealthcareService; locations?: Location[]; serviceArea?: Location } | undefined;
  practitioner?: Practitioner;
}

function getPaperworkSupportingInfoForUserWithAccess(input: GetPaperworkSupportingInfoInput): PaperworkSupportingInfo {
  const { appointment, patient, location, hsResources, practitioner } = input;
  return {
    appointment: {
      id: appointment?.id ?? 'Unknown', // i hate this
      start: appointment?.start || 'Unknown',
      location: makeLocationSummary({ appointment, location, hsResources, practitioner }),
      visitType: appointment?.appointmentType?.text as VisitType,
      status: appointment?.status,
      unconfirmedDateOfBirth: appointment ? getUnconfirmedDOBForAppointment(appointment) : undefined,
    },
    patient: {
      id: patient.id,
      firstName: patient.name?.[0].given?.[0],
      dateOfBirth: patient.birthDate,
    },
  };
}

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
interface LocationSummaryInput {
  appointment: Appointment;
  location?: Location;
  hsResources?: HealthcareServiceWithLocationContext;
  practitioner?: Practitioner;
}
const makeLocationSummary = (input: LocationSummaryInput): AppointmentSummary['location'] => {
  const { appointment, location, hsResources, practitioner } = input;
  if (hsResources) {
    // do a thing
    const { hs, locations, coverageArea } = hsResources;
    const closures: Closure[] = [];
    const otherOffices: AvailableLocationInformation['otherOffices'] = [];
    const serviceMode = serviceModeForHealthcareService(hs);
    let loc: Location | undefined;
    // note there's not really any clear notion what to do here if the HS pools provider schedules
    // this is to be addressed in a future release
    if (serviceMode === ServiceMode['in-person']) {
      // this is most likely a fictional use case...
      loc = locations?.find((tempLoc) => {
        return appointment?.participant?.some((maybeLoc) => {
          const reference = maybeLoc.actor?.reference;
          if (reference) {
            return reference === `${tempLoc.resourceType}/${tempLoc.id}`;
          }
          return false;
        });
      });
      if (loc === undefined) {
        loc = locations?.length === 1 ? locations[0] : undefined;
      }
      if (loc) {
        const schedule = getScheduleDetails(loc);
        if (schedule && schedule.closures) {
          closures.push(...schedule.closures);
        }
      }
    } else {
      loc = coverageArea?.length === 1 ? coverageArea[0] : undefined;
    }
    return {
      id: loc?.id,
      slug: loc?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value,
      name: loc?.name ?? hs?.name,
      description: loc?.description,
      address: loc?.address,
      telecom: loc?.telecom,
      hoursOfOperation: loc?.hoursOfOperation,
      closures: [],
      timezone: loc?.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString,
      otherOffices,
      scheduleType: ScheduleType['group'],
    };
  } else if (practitioner) {
    // todo build out pracitioner scheduling more
    return {
      id: practitioner?.id,
      slug: practitioner?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value,
      name: `${practitioner.name?.[0]?.given?.[0]} ${practitioner.name?.[0]?.family}`,
      description: undefined,
      address: undefined,
      telecom: [],
      hoursOfOperation: [],
      closures: [],
      timezone: practitioner?.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString,
      otherOffices: [],
      scheduleType: ScheduleType['provider'],
    };
  } else {
    const closures: Closure[] = [];
    if (location) {
      const schedule = getScheduleDetails(location);
      if (schedule && schedule.closures) {
        closures.push(...schedule.closures);
      }
    }
    return {
      id: location?.id,
      slug: location?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value,
      name: location?.name,
      description: location?.description,
      address: location?.address,
      telecom: location?.telecom,
      hoursOfOperation: location?.hoursOfOperation,
      closures,
      timezone: location?.extension?.find(
        (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
      )?.valueString,
      otherOffices: location ? getOtherOfficesForLocation(location) : [],
      scheduleType: ScheduleType['location'],
    };
  }
};
