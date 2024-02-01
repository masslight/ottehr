import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';
import {
  CancellationReasonCodes,
  TwilioConversationModel,
  createFhirClient,
  getConversationModelsFromResourceList,
  getPersonsFromResourceList,
  getRelatedPersonsFromResourceList,
} from '../shared/helpers';
import {
  Appointment,
  DocumentReference,
  Encounter,
  Location,
  Patient,
  Person,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4';
import { getAuth0Token } from '../shared';
import { DateTime } from 'luxon';
import { topLevelCatch } from '../shared/errors';
import {
  VisitStatusHistoryEntry,
  VisitStatus,
  getStatusLabelForAppointmentAndEncounter,
  getVisitStatusHistory,
} from '../shared/fhirStatusMappingUtils';
export interface GetAppointmentsInput {
  searchDate: string;
  locationId: string;
  secrets: Secrets | null;
}

const FHIR_APPOINTMENT_TYPE_MAP: any = {
  walkin: 'walk-in',
  prebook: 'booked',
};

interface AppointmentInformation {
  id: string;
  start: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  reasonForVisit: string;
  comment: string | undefined;
  appointmentType: string;
  appointmentStatus: string;
  status: VisitStatus;
  cancellationReason: string | undefined;
  paperwork: {
    demographics: boolean;
    photoID: boolean;
    insuranceCard: boolean;
    consent: boolean;
  };
  next: boolean;
  visitStatusHistory: VisitStatusHistoryEntry[];
  unconfirmedDateOfBirth: boolean | undefined;
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
    const preBooked: AppointmentInformation[] = [];
    let inOfficeInExam: AppointmentInformation[] = [];
    const completed: AppointmentInformation[] = [];
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

    const searchDateWithTimezone = DateTime.fromISO(searchDate).setZone(timezone);
    const allResources: Resource[] = await fhirClient?.searchResources({
      resourceType: 'Appointment',
      searchParams: [
        {
          name: 'date',
          value: `ge${searchDateWithTimezone.startOf('day')}`,
        },
        {
          name: 'date',
          value: `le${searchDateWithTimezone.endOf('day')}`,
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
    allResources.forEach((resource) => {
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

    const conversationModels = getConversationModelsFromResourceList(allResources);
    const persons = getPersonsFromResourceList(allResources);
    const relatedPersons = getRelatedPersonsFromResourceList(allResources);

    let nextArrived = false;
    let nextReady = false;
    let nextReadyForProvider = false;
    const waiting: AppointmentInformation[] = [];

    allResources.forEach((resource) => {
      if (resource.resourceType === 'Appointment') {
        const appointment = resource as Appointment;
        const patientId = appointment.participant
          .find((appt) => appt.actor?.reference?.startsWith('Patient/'))
          ?.actor?.reference?.replace('Patient/', '');
        const patient = allResources.find((resourceTemp) => resourceTemp.id === patientId) as Patient;
        const encounter: Encounter = allResources.find(
          (resourceTemp) =>
            resourceTemp.resourceType === 'Encounter' &&
            (resourceTemp as Encounter)?.appointment?.[0].reference === `Appointment/${appointment.id}`,
        ) as Encounter;

        const questionnaireResponse = allResources.find(
          (resourceTemp) =>
            resourceTemp.resourceType === 'QuestionnaireResponse' &&
            (resourceTemp as QuestionnaireResponse)?.encounter?.reference === `Encounter/${encounter.id}`,
        ) as QuestionnaireResponse;
        const consentComplete =
          questionnaireResponse?.item?.find((item) => item.linkId === 'hipaa-acknowledgement')?.answer?.[0]
            .valueBoolean === true &&
          questionnaireResponse?.item?.find((item) => item.linkId === 'consent-to-treat')?.answer?.[0].valueBoolean ===
            true &&
          questionnaireResponse?.item?.find((item) => item.linkId === 'signature') &&
          questionnaireResponse?.item?.find((item) => item.linkId === 'full-name') &&
          questionnaireResponse?.item?.find((item) => item.linkId === 'consent-form-signer-relationship');
        const docRefComplete = (type: string, frontTitle: string, backTitle: string): boolean => {
          const docFound = allDocRefs.find(
            (document) =>
              document.context?.related?.find((related) => related.reference === `Patient/${patient.id}`) &&
              document.type?.text === type,
          );
          const front = docFound?.content.find((content) => content.attachment.title === frontTitle);
          const back = docFound?.content.find((content) => content.attachment.title === backTitle);
          return front && back ? true : false;
        };
        const idCard = docRefComplete('Photo ID cards', 'id-front', 'id-back');
        const insuranceCard = docRefComplete('Insurance cards', 'insurance-card-front', 'insurance-card-back');
        const cancellationReason = appointment.cancelationReason?.coding?.[0].code;
        const status = getStatusLabelForAppointmentAndEncounter(appointment);
        if (!appointment.start) {
          console.log('No start time for appointment');
          return;
        }
        const appointmentTemp: AppointmentInformation = {
          id: appointment.id || 'Unknown',
          start: DateTime.fromISO(appointment.start).setZone(timezone).toISO() || 'Unknown',
          patient: {
            id: patient.id || 'Unknown',
            firstName: patient?.name?.[0].given?.[0] || 'Unknown',
            lastName: patient?.name?.[0].family || 'Unknown',
            dateOfBirth: patient.birthDate || 'Unknown',
          },
          reasonForVisit: appointment.description || 'Unknown',
          comment: appointment.comment,
          appointmentType: appointment.appointmentType?.text
            ? FHIR_APPOINTMENT_TYPE_MAP[appointment.appointmentType?.text]
            : 'Unknown',
          appointmentStatus: appointment.status,
          status: status,
          cancellationReason: cancellationReason,
          paperwork: {
            demographics: questionnaireResponse ? true : false,
            photoID: idCard,
            insuranceCard: insuranceCard,
            consent: consentComplete ? true : false,
          },
          next: false,
          visitStatusHistory: getVisitStatusHistory(appointment),
          unconfirmedDateOfBirth: appointment?.extension?.find(
            (e) => e.url === 'http://fhir.zapehr.com/r4/StructureDefinitions/date-of-birth-not-confirmed',
          )
            ? true
            : false,
        };
        if (status === 'pending') {
          preBooked.push(appointmentTemp);
        } else if (['checked out', 'canceled', 'no show'].includes(status)) {
          completed.push(appointmentTemp);
        } else {
          if (!['arrived', 'ready'].includes(status)) {
            inOfficeInExam.push(appointmentTemp);
          } else {
            waiting.push(appointmentTemp);
          }
        }
      } else if (resource.resourceType === 'Location') {
        fhirLocation = resource as Location;
      }
    });

    // sort in office waiting room
    const inOfficeOrder = ['arrived', 'ready'];
    waiting.sort((appointmentOne, appointmentTwo) => {
      // Waiting room is ordered by arrived first, then ready.
      const statusSort = inOfficeOrder.indexOf(appointmentOne.status) - inOfficeOrder.indexOf(appointmentTwo.status);
      if (statusSort !== 0) {
        return statusSort;
      }

      const minutesUntilApptOneStart = DateTime.fromISO(appointmentOne.start).diffNow('minutes').minutes; // appointment starts in the past will yeild negative minutes
      const minutesApptTwoWaiting = -DateTime.fromISO(appointmentTwo.start).diffNow('minutes').minutes;

      // Arrived is ordered by appointment start, if there are no prebook
      // appointments in the next 15 minutes, non-prebook goes first.
      if (
        appointmentOne.status === 'arrived' &&
        appointmentTwo.status === 'arrived' &&
        appointmentOne.appointmentType === 'booked' &&
        appointmentTwo.appointmentType === 'walk-in' &&
        minutesUntilApptOneStart <= 15
      ) {
        return -1;
      }

      // Ready is ordered by appointment start, if there are no prebook
      // appointments in the next 10 minutes, non-prebook goes first unless
      // non prebook has been waiting more than 45 minutes
      if (
        appointmentOne.status === 'ready' &&
        appointmentTwo.status === 'ready' &&
        appointmentOne.appointmentType === 'booked' &&
        appointmentTwo.appointmentType === 'walk-in' &&
        minutesUntilApptOneStart <= 10 &&
        minutesApptTwoWaiting <= 45 // walkins waiting less than 45 minutes don't get priority
      ) {
        return -1;
      }

      return 0;
    });

    // sort in office in exam
    const prebookedOrder = ['intake', 'ready for provider', 'provider', 'ready for discharge'];
    inOfficeInExam = inOfficeInExam.sort((appointmentOne, appointmentTwo) => {
      // sort by appointment status then sort by appointment time
      const statusSort = prebookedOrder.indexOf(appointmentOne.status) - prebookedOrder.indexOf(appointmentTwo.status);
      if (statusSort !== 0) {
        return statusSort;
      }

      const minutesUntilApptOneStart = DateTime.fromISO(appointmentOne.start).diffNow('minutes').minutes; // appointment starts in the past will yeild negative minutes
      const minutesApptTwoWaiting = -DateTime.fromISO(appointmentTwo.start).diffNow('minutes').minutes;
      // sort ready for provider appointments
      // non-prebook first unless there is a pre-book with a booking time within 5 minutes or in the past
      // and no non-prebooks have been waiting for 45 minutes or more
      if (
        appointmentOne.status === 'ready for provider' &&
        appointmentTwo.status === 'ready for provider' &&
        appointmentOne.appointmentType === 'booked' &&
        appointmentTwo.appointmentType === 'walk-in' &&
        minutesUntilApptOneStart <= 5 &&
        minutesApptTwoWaiting <= 45 // walkins waiting less than 45 minutes don't get priority
      ) {
        return -1;
      }

      return DateTime.fromISO(appointmentOne.start).toSeconds() - DateTime.fromISO(appointmentTwo.start).toSeconds();
    });

    // why are inExam in the waiting room queue??
    const inOffice = waiting.concat(inOfficeInExam);

    inOffice.forEach((appointment) => {
      if (!nextArrived && appointment.status === 'arrived') {
        appointment.next = true;
        nextArrived = true;
      } else if (!nextReady && appointment.status === 'ready') {
        appointment.next = true;
        nextReady = true;
      } else if (!nextReadyForProvider && appointment.status === 'ready for provider') {
        appointment.next = true;
        nextReadyForProvider = true;
      }
    });

    completed.sort((appointmentOne, appointmentTwo) => {
      const statusStartA = appointmentOne.visitStatusHistory.find((history) => history.label === appointmentOne.status)
        ?.period.start;
      const statusStartB = appointmentTwo.visitStatusHistory.find((history) => history.label === appointmentTwo.status)
        ?.period.start;
      if (statusStartA && statusStartB) {
        return DateTime.fromISO(statusStartB).diff(DateTime.fromISO(statusStartA), 'seconds').seconds;
      }
      return -1;
    });

    const response = {
      message: 'Successfully retrieved all appointments',
      preBooked: mapAppointmentInformationToConversationModel({
        appointments: preBooked,
        relatedPersons,
        persons,
        conversationModels,
      }),
      inOffice: mapAppointmentInformationToConversationModel({
        appointments: inOffice,
        relatedPersons,
        persons,
        conversationModels,
      }),
      completed: mapAppointmentInformationToConversationModel({
        appointments: completed,
        relatedPersons,
        persons,
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
  persons: Person[];
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
    const personID = input.persons.find((p) =>
      p.link?.find((linkTemp) => linkTemp.target.reference === `RelatedPerson/${relatedPerson.id}`),
    )?.id;
    const conversationModel = conversationModels.find((cv) => cv.relatedPersonParticipants.has(relatedPerson.id ?? ''));
    return {
      ...app,
      personID,
      conversationModel,
    };
  });
};
