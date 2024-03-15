import { APIGatewayProxyResult } from 'aws-lambda';
import { AppointmentInformation, Secrets, ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';
import {
  CancellationReasonCodes,
  TwilioConversationModel,
  createFhirClient,
  getConversationModelsFromResourceList,
  getRelatedPersonsFromResourceList,
} from '../shared/helpers';
import {
  Appointment,
  DocumentReference,
  Encounter,
  Location,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4';
import { SecretsKeys, getAuth0Token, getSecret } from '../shared';
import { DateTime } from 'luxon';
import {
  VisitStatus,
  getVisitStatusHistory,
  getStatusLabelForAppointmentAndEncounter,
} from '../shared/fhirStatusMappingUtils';
import { topLevelCatch } from '../shared/errors';
import { appointmentTypeForAppointment, sortAppointments } from '../shared/queueingUtils';
export interface GetAppointmentsInput {
  searchDate: string;
  locationId: string;
  secrets: Secrets | null;
}

export function getAppointmentStatusInformation(
  appointmentStatus: string,
  appointmentCancellationReason: string | undefined,
  encounterStatus: string | undefined,
): VisitStatus {
  if (appointmentStatus === 'booked') {
    return 'pending';
  } else if (appointmentStatus === 'arrived') {
    return 'arrived';
  } else if (encounterStatus === 'planned') {
    return 'ready';
  } else if (appointmentStatus === 'checked-in') {
    return 'intake';
  } else if (encounterStatus === 'triaged') {
    return 'ready for provider';
  } else if (encounterStatus === 'in-progress') {
    return 'provider';
    // todo
  } else if (encounterStatus === 'todo') {
    return 'ready for discharge';
  } else if (encounterStatus === 'finished') {
    return 'checked out';
  } else if (
    appointmentStatus === 'cancelled' &&
    appointmentCancellationReason &&
    Object.values(CancellationReasonCodes).includes(appointmentCancellationReason)
  ) {
    return 'canceled';
  } else if (appointmentStatus === 'cancelled' && appointmentCancellationReason === 'no-show') {
    return 'no show';
  } else {
    return 'unknown';
  }
}

let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { searchDate, secrets, locationId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(zapehrToken, secrets);
    let activeAppointmentDatesBeforeToday: string[] = [];
    let fhirLocation = undefined;

    const locationSearchResults = await fhirClient.searchResources({
      resourceType: 'Location',
      searchParams: [
        {
          name: '_id',
          value: locationId,
        },
      ],
    });

    if (locationSearchResults.length !== 1) {
      throw new Error('location is not found');
    }

    fhirLocation = locationSearchResults[0] as Location;
    const timezone = fhirLocation?.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
    )?.valueString;

    const activeEncounters: Resource[] = await fhirClient?.searchResources({
      resourceType: 'Encounter',
      searchParams: [
        { name: '_count', value: '1000' },
        { name: '_include', value: 'Encounter:appointment' },
        { name: 'appointment._tag', value: 'OTTEHR-UC' },
        { name: 'appointment.date', value: `lt${DateTime.now().setZone(timezone).startOf('day')}` },
        { name: 'appointment.location', value: `Location/${locationId}` },
        { name: 'status:not', value: 'planned' },
        { name: 'status:not', value: 'finished' },
        { name: 'status:not', value: 'cancelled' },
      ],
    });

    const tempAppointmentDates = activeEncounters
      .filter((resource) => {
        return resource.resourceType === 'Appointment';
      })
      .sort((r1, r2) => {
        const d1 = DateTime.fromISO((r1 as Appointment).start || '');
        const d2 = DateTime.fromISO((r2 as Appointment).start || '');
        return d1.diff(d2).toMillis();
      })
      .map((resource) => {
        return DateTime.fromISO((resource as Appointment).start || '')
          .setZone(timezone)
          .toFormat('MM/dd/yyyy');
      });

    activeAppointmentDatesBeforeToday = [...tempAppointmentDates];

    const searchDateWithTimezone = DateTime.fromISO(searchDate).setZone(timezone);
    const searchResultsForSelectedDate: Resource[] = await fhirClient?.searchResources({
      resourceType: 'Appointment',
      searchParams: [
        {
          name: '_tag',
          value: 'OTTEHR-UC',
        },
        {
          name: 'date',
          value: `ge${searchDateWithTimezone.startOf('day')}`,
        },
        {
          name: 'date',
          value: `le${searchDateWithTimezone.endOf('day')}`,
        },
        {
          name: 'date:missing',
          value: 'false',
        },
        {
          name: 'location',
          value: `Location/${locationId}`,
        },
        {
          name: '_sort',
          value: 'date',
        },
        { name: '_count', value: '1000' },
        {
          name: '_include',
          value: 'Appointment:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'RelatedPerson:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Person:link',
        },
        {
          name: '_revinclude:iterate',
          value: 'Encounter:participant',
        },
        {
          name: '_include',
          value: 'Appointment:location',
        },
        {
          name: '_revinclude:iterate',
          value: 'Encounter:appointment',
        },
        { name: '_revinclude:iterate', value: 'DocumentReference:patient' },
        { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
      ],
    });
    // array of patient ids to get related documents
    const patientIds: string[] = [];
    searchResultsForSelectedDate.forEach((resource) => {
      if (resource.resourceType === 'Appointment') {
        const appointment = resource as Appointment;
        const patientId = appointment.participant
          .find((appt) => appt.actor?.reference?.startsWith('Patient/'))
          ?.actor?.reference?.replace('Patient/', '');
        if (patientId) patientIds.push(`Patient/${patientId}`);
      }
    });
    const allDocRefs: DocumentReference[] = await fhirClient?.searchResources({
      resourceType: 'DocumentReference',
      searchParams: [
        { name: 'status', value: 'current' },
        { name: 'type', value: '64290-0,55188-7' },
        { name: 'related', value: patientIds.join(',') },
      ],
    });

    const conversationModels = getConversationModelsFromResourceList(searchResultsForSelectedDate);
    // const persons = getPersonsFromResourceList(searchResultsForSelectedDate);
    const relatedPersons = getRelatedPersonsFromResourceList(searchResultsForSelectedDate);
    const appointments: Appointment[] = [];
    const patientIdMap: Record<string, Patient> = {};
    const apptRefToEncounterMap: Record<string, Encounter> = {};
    const encounterRefToQRMap: Record<string, QuestionnaireResponse> = {};

    searchResultsForSelectedDate.forEach((resource) => {
      if (resource.resourceType === 'Appointment') {
        appointments.push(resource as Appointment);
      } else if (resource.resourceType === 'Patient' && resource.id) {
        patientIdMap[resource.id] = resource as Patient;
      } else if (resource.resourceType === 'Encounter') {
        const asEnc = resource as Encounter;
        const apptRef = asEnc.appointment?.[0].reference;
        if (apptRef) {
          apptRefToEncounterMap[apptRef] = asEnc;
        }
      } else if (resource.resourceType === 'QuestionnaireResponse') {
        const encRef = (resource as QuestionnaireResponse).encounter?.reference;
        if (encRef) {
          encounterRefToQRMap[encRef] = resource as QuestionnaireResponse;
        }
      } else if (resource.resourceType === 'Location') {
        fhirLocation = resource as Location;
      }
    });

    const appointmentQueues = sortAppointments(appointments, getSecret(SecretsKeys.ENVIRONMENT, secrets));
    const baseMapInput: Omit<AppointmentInformationInputs, 'appointment'> = {
      timezone,
      encounterRefToQRMap,
      allDocRefs,
      apptRefToEncounterMap,
      patientIdMap,
      next: false,
    };

    const preBooked = appointmentQueues.prebooked.map((appointment) => {
      return makeAppointmentInformation({
        appointment,
        ...baseMapInput,
      });
    });
    const inOffice = [
      ...appointmentQueues.inOffice.waitingRoom.arrived.map((appointment, idx) => {
        return makeAppointmentInformation({
          appointment,
          ...baseMapInput,
          next: idx === 0,
        });
      }),
      ...appointmentQueues.inOffice.waitingRoom.ready.map((appointment, idx) => {
        return makeAppointmentInformation({
          appointment,
          ...baseMapInput,
          next: idx === 0,
        });
      }),
      ...appointmentQueues.inOffice.inExam.intake.map((appointment) => {
        return makeAppointmentInformation({
          appointment,
          ...baseMapInput,
        });
      }),
      ...appointmentQueues.inOffice.inExam['ready for provider'].map((appointment, idx) => {
        return makeAppointmentInformation({
          appointment,
          ...baseMapInput,
          next: idx === 0,
        });
      }),
      ...appointmentQueues.inOffice.inExam.provider.map((appointment) => {
        return makeAppointmentInformation({
          appointment,
          ...baseMapInput,
        });
      }),
      ...appointmentQueues.inOffice.inExam['ready for discharge'].map((appointment) => {
        return makeAppointmentInformation({
          appointment,
          ...baseMapInput,
        });
      }),
    ];
    const completed = appointmentQueues.checkedOut.map((appointment) => {
      return makeAppointmentInformation({
        appointment,
        ...baseMapInput,
      });
    });
    const canceled = appointmentQueues.canceled.map((appointment) => {
      return makeAppointmentInformation({
        appointment,
        ...baseMapInput,
      });
    });

    const response = {
      activeApptDatesBeforeToday: activeAppointmentDatesBeforeToday.filter(
        (value, index, array) => array.indexOf(value) === index,
      ), // remove duplicate dates
      message: 'Successfully retrieved all appointments',
      preBooked: mapAppointmentInformationToConversationModel({
        appointments: preBooked,
        relatedPersons,
        conversationModels,
      }),
      inOffice: mapAppointmentInformationToConversationModel({
        appointments: inOffice,
        relatedPersons,
        conversationModels,
      }),
      completed: mapAppointmentInformationToConversationModel({
        appointments: completed,
        relatedPersons,
        conversationModels,
      }),
      cancelled: mapAppointmentInformationToConversationModel({
        appointments: canceled,
        relatedPersons,
        conversationModels,
      }),
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('admin-get-appointments', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting patient appointments' }),
    };
  }
};

interface MapInput {
  appointments: AppointmentInformation[];
  relatedPersons: RelatedPerson[];
  conversationModels: TwilioConversationModel[];
}

interface MapOutput extends AppointmentInformation {
  conversationModel?: TwilioConversationModel;
}

const mapAppointmentInformationToConversationModel = (input: MapInput): MapOutput[] => {
  const { appointments, relatedPersons, conversationModels } = input;

  return appointments.map((app) => {
    const relatedPerson = relatedPersons.find((rp) => {
      const patientRef = rp.patient.reference;
      if (!patientRef) {
        console.log('conversationModel not found no patient ref!');
        return app;
      }
      return patientRef === `Patient/${app.patient.id}` && rp.id;
    });
    if (!relatedPerson) {
      console.log('conversationModel not found!');
      return app;
    }
    const conversationModel = conversationModels.find((cv) => cv.relatedPersonParticipants.has(relatedPerson.id ?? ''));
    return {
      ...app,
      conversationModel,
    };
  });
};

interface AppointmentInformationInputs {
  appointment: Appointment;
  patientIdMap: Record<string, Patient>;
  apptRefToEncounterMap: Record<string, Encounter>;
  encounterRefToQRMap: Record<string, QuestionnaireResponse>;
  allDocRefs: DocumentReference[];
  timezone: string | undefined;
  next: boolean;
}

const makeAppointmentInformation = (input: AppointmentInformationInputs): AppointmentInformation => {
  const { appointment, timezone, patientIdMap, apptRefToEncounterMap, encounterRefToQRMap, allDocRefs, next } = input;

  const patientId = appointment.participant
    .find((appt) => appt.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.replace('Patient/', '');
  const patient = patientId ? patientIdMap[patientId] : undefined;
  const encounter = apptRefToEncounterMap[`Appointment/${appointment.id}`];
  const questionnaireResponse = encounterRefToQRMap[`Encounter/${encounter?.id}`];

  const consentComplete =
    questionnaireResponse?.item?.find((item) => item.linkId === 'hipaa-acknowledgement')?.answer?.[0].valueBoolean ===
      true &&
    questionnaireResponse?.item?.find((item) => item.linkId === 'consent-to-treat')?.answer?.[0].valueBoolean ===
      true &&
    questionnaireResponse?.item?.find((item) => item.linkId === 'signature') &&
    questionnaireResponse?.item?.find((item) => item.linkId === 'full-name') &&
    questionnaireResponse?.item?.find((item) => item.linkId === 'consent-form-signer-relationship');
  const docRefComplete = (type: string, frontTitle: string, backTitle: string): boolean => {
    const docFound = allDocRefs.find(
      (document) =>
        document.context?.related?.find((related) => related.reference === `Patient/${patient?.id}`) &&
        document.type?.text === type,
    );
    const front = docFound?.content.find((content) => content.attachment.title === frontTitle);
    const back = docFound?.content.find((content) => content.attachment.title === backTitle);
    return front || back ? true : false;
  };
  const idCard = docRefComplete('Photo ID cards', 'photo-id-front', 'photo-id-back');
  const insuranceCard = docRefComplete('Insurance cards', 'insurance-card-front', 'insurance-card-back');
  const cancellationReason = appointment.cancelationReason?.coding?.[0].code;
  const status = getStatusLabelForAppointmentAndEncounter(appointment);

  const unconfirmedDOB: string | undefined = appointment?.extension?.find(
    (e) => e.url === 'http://fhir.zapehr.com/r4/StructureDefinitions/date-of-birth-not-confirmed',
  )?.valueString;

  return {
    id: appointment?.id,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    start: DateTime.fromISO(appointment.start!).setZone(timezone).toISO() || 'Unknown',
    patient: {
      id: patient?.id,
      firstName: patient?.name?.[0].given?.[0] || 'Unknown',
      lastName: patient?.name?.[0].family || 'Unknown',
      dateOfBirth: patient?.birthDate || 'Unknown',
    },
    reasonForVisit: appointment.description || 'Unknown',
    comment: appointment.comment,
    unconfirmedDOB: unconfirmedDOB ?? '',
    appointmentType: appointmentTypeForAppointment(appointment),
    appointmentStatus: appointment.status,
    status: status,
    cancellationReason: cancellationReason,
    paperwork: {
      demographics: questionnaireResponse ? true : false,
      photoID: idCard,
      insuranceCard: insuranceCard,
      consent: consentComplete ? true : false,
    },
    next,
    visitStatusHistory: getVisitStatusHistory(appointment),
    needsDOBConfirmation: appointment?.extension?.find(
      (e) => e.url === 'http://fhir.zapehr.com/r4/StructureDefinitions/date-of-birth-not-confirmed',
    )
      ? true
      : false,
  };
};
