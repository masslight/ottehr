import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Communication,
  DocumentReference,
  Encounter,
  Location,
  Patient,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  RelatedPerson,
} from 'fhir/r4';
import { DateTime } from 'luxon';
import {
  OTTEHR_MODULE,
  UCAppointmentInformation,
  SMSModel,
  SMSRecipient,
  Secrets,
  ZAP_SMS_MEDIUM_CODE,
  getChatContainsUnreadMessages,
  getSMSNumberForIndividual,
  getUnconfirmedDOBForAppointment,
  isTruthy,
  getVisitStatusHistory,
  getStatusLabelForAppointmentAndEncounter,
} from 'ehr-utils';
import { SecretsKeys, getSecret } from '../shared';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken, createFhirClient, getRelatedPersonsFromResourceList } from '../shared/helpers';
import { appointmentTypeForAppointment, sortAppointments } from '../shared/queueingUtils';
import { ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetAppointmentsInput {
  searchDate: string;
  locationId: string;
  visitType: string[];
  secrets: Secrets | null;
}

let m2mtoken: string;

const SKIP = 'skip';
const timezoneMap: Map<string, string> = new Map();
const encounterIdMap: Map<string, string> = new Map();

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { visitType, searchDate, secrets, locationId } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);

    const fhirClient = createFhirClient(m2mtoken, secrets);
    let activeAppointmentDatesBeforeToday: string[] = [];
    let fhirLocation: Location | undefined = undefined;
    let timezone: string | undefined = timezoneMap.get(locationId);
    console.log('timezone, map', timezone, JSON.stringify(timezoneMap));
    console.time('get-timezone');
    if (!timezone) {
      try {
        console.log(`reading location ${locationId}`);
        fhirLocation = await fhirClient.readResource<Location>({
          resourceId: locationId,
          resourceType: 'Location',
        });
        timezone = fhirLocation?.extension?.find(
          (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
        )?.valueString;
        if (timezone) {
          timezoneMap.set(locationId, timezone);
        }
        console.log('found location: ', fhirLocation.name);
      } catch (e) {
        console.log('error getting location', JSON.stringify(e));
        throw new Error('location is not found');
      }
    }
    console.timeEnd('get-timezone');
    console.log('timezone2, map2', timezone, timezoneMap);

    console.time('get_active_encounters + get_appointment_data');

    const encounterSearchParams = [
      { name: '_count', value: '1000' },
      { name: '_include', value: 'Encounter:appointment' },
      { name: 'appointment._tag', value: OTTEHR_MODULE.UC },
      { name: 'appointment.date', value: `lt${DateTime.now().setZone(timezone).startOf('day')}` },
      { name: 'appointment.location', value: `Location/${locationId}` },
      { name: 'status:not', value: 'planned' },
      { name: 'status:not', value: 'finished' },
      { name: 'status:not', value: 'cancelled' },
    ];
    const idMapKey = `${locationId}|${DateTime.now().setZone(timezone).startOf('day').toISODate()}`;
    const cachedEncounterIds = encounterIdMap.get(idMapKey);

    // if we have cached encounter ids, add them to the search for a big optimization boost
    if (cachedEncounterIds && cachedEncounterIds !== SKIP) {
      encounterSearchParams.push({
        name: '_id',
        value: cachedEncounterIds,
      });
    }
    // if we know previous search turned up no problem encounters, skip this search entirely and
    // return an empty array. see note below where the rationale for this behavior is explained.
    let encounterSearch: Promise<(Encounter | Appointment)[]>;
    if (cachedEncounterIds === SKIP) {
      encounterSearch = new Promise((resolve, _) => {
        resolve([]);
      });
    } else {
      encounterSearch = fhirClient?.searchResources<Encounter | Appointment>({
        resourceType: 'Encounter',
        searchParams: encounterSearchParams,
      });
    }

    const searchDateWithTimezone = DateTime.fromISO(searchDate).setZone(timezone);
    const appointmentSearch = fhirClient?.searchResources({
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
    const [activeEncounters, searchResultsForSelectedDate] = await Promise.all([encounterSearch, appointmentSearch]);
    console.timeEnd('get_active_encounters + get_appointment_data');
    // console.log(searchResultsForSelectedDate);

    const encounterIds: string[] = [];

    const tempAppointmentDates = activeEncounters
      .filter((resource) => {
        if (resource.resourceType === 'Encounter' && resource.id) {
          encounterIds.push(resource.id);
        }
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

    // we now know whether and which encounters are un-cleaned-up at this location for this date; we can either search for exactly those or skip
    // the encounter search entirely
    // something very odd would need to happen for an encounter to retroactively enter the unresolved state, and if it happened it would get found
    // tomorrow rather than today (or when this zambda context gets cleaned up). therefore it is a pretty easy cost/benefit call to forego this search
    // when we know it recently returned no results, or optimize to only target encounters that met the search criteria in the first execution.
    if (encounterIds.length) {
      encounterIdMap.set(idMapKey, encounterIds.join(','));
    } else {
      encounterIdMap.set(idMapKey, SKIP);
    }

    activeAppointmentDatesBeforeToday = [...tempAppointmentDates];

    let preBooked: UCAppointmentInformation[] = [];
    let inOffice: UCAppointmentInformation[] = [];
    let completed: UCAppointmentInformation[] = [];
    let canceled: UCAppointmentInformation[] = [];

    if (searchResultsForSelectedDate?.length == 0) {
      const response = {
        activeApptDatesBeforeToday: activeAppointmentDatesBeforeToday.filter(
          (value, index, array) => array.indexOf(value) === index,
        ), // remove duplicate dates
        message: 'Successfully retrieved all appointments',
        preBooked,
        inOffice,
        completed,
        cancelled: canceled, // grrr
      };
      console.timeEnd('structure_appointment_data');

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

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

    console.time('parse_search_results');
    // const persons = getPersonsFromResourceList(searchResultsForSelectedDate);
    const patientToRPMap: Record<string, RelatedPerson[]> =
      getRelatedPersonsFromResourceList(searchResultsForSelectedDate);

    // console.log('patientToRPMap', JSON.stringify(patientToRPMap));
    const allAppointments: Appointment[] = [];
    const patientIdMap: Record<string, Patient> = {};
    const apptRefToEncounterMap: Record<string, Encounter> = {};
    const encounterRefToQRMap: Record<string, QuestionnaireResponse> = {};
    const patientRefToQRMap: Record<string, QuestionnaireResponse> = {};
    const rpToCommMap: Record<string, Communication[]> = {};
    const rpPhoneNumbers = new Set<string>();
    const phoneNumberToRpMap: Record<string, string[]> = {};
    const rpIdToResourceMap: Record<string, RelatedPerson> = {};

    searchResultsForSelectedDate.forEach((resource) => {
      if (resource.resourceType === 'Appointment') {
        allAppointments.push(resource as Appointment);
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
        const patientRef = (resource as QuestionnaireResponse).subject?.reference;
        if (encRef) {
          encounterRefToQRMap[encRef] = resource as QuestionnaireResponse;
        }
        if (patientRef) {
          if (patientRefToQRMap[patientRef]) {
            const qrAuthoredDate = DateTime.fromISO(patientRefToQRMap[patientRef].authored || '');
            const curQrAuthoredDate = DateTime.fromISO((resource as QuestionnaireResponse).authored || '');
            if (curQrAuthoredDate.diff(qrAuthoredDate).as('minutes') > 0) {
              patientRefToQRMap[patientRef] = resource as QuestionnaireResponse;
            }
          } else {
            patientRefToQRMap[patientRef] = resource as QuestionnaireResponse;
          }
        }
      } else if (resource.resourceType === 'Location') {
        fhirLocation = resource as Location;
      } else if (resource.resourceType === 'RelatedPerson' && resource.id) {
        rpIdToResourceMap[`RelatedPerson/${resource.id}`] = resource as RelatedPerson;
        const pn = getSMSNumberForIndividual(resource as RelatedPerson);
        if (pn) {
          rpPhoneNumbers.add(pn);
          const mapVal = phoneNumberToRpMap[pn] ?? [];
          mapVal.push(`RelatedPerson/${resource.id}`);
          phoneNumberToRpMap[pn] = mapVal;
        }
      }
    });
    console.timeEnd('parse_search_results');

    console.time('get_all_doc_refs + get_all_communications');
    const docRefPromise = fhirClient?.searchResources<DocumentReference>({
      resourceType: 'DocumentReference',
      searchParams: [
        { name: 'status', value: 'current' },
        { name: 'type', value: '64290-0,55188-7' },
        { name: 'related', value: patientIds.join(',') },
      ],
    });
    const uniqueNumbers = Array.from(rpPhoneNumbers);
    const communicationsPromise = fhirClient.searchResources<Communication | RelatedPerson>({
      resourceType: 'Communication',
      searchParams: [
        { name: 'medium', value: `${ZAP_SMS_MEDIUM_CODE}` },
        { name: 'sender:RelatedPerson.telecom', value: uniqueNumbers.join(',') },
        { name: '_include', value: 'Communication:sender' },
      ],
    });

    let allDocRefs: DocumentReference[] | undefined = undefined;
    let communications: (Communication | RelatedPerson)[] | undefined = undefined;

    if (uniqueNumbers?.length > 0) {
      [allDocRefs, communications] = await Promise.all([docRefPromise, communicationsPromise]);
    } else {
      allDocRefs = await docRefPromise;
    }

    console.timeEnd('get_all_doc_refs + get_all_communications');

    // because the related person tied to the user's account has been excluded from the graph of persons
    // connected to patient resources, while the Zap sms creates communications with sender reference based on
    // the user's profile-linked resource, it is necessary to do this cross-referencing to map from the sender resource
    // on sms Communication resources to the related person list associated with each patient
    // this cuts around 3 seconds off the execution time for this zambda, or more when there are no results
    if (communications && communications.length > 0) {
      const commSenders: RelatedPerson[] = communications.filter(
        (resource) => resource.resourceType === 'RelatedPerson',
      ) as RelatedPerson[];
      commSenders.forEach((resource) => {
        rpIdToResourceMap[`RelatedPerson/${resource.id}`] = resource as RelatedPerson;
        const pn = getSMSNumberForIndividual(resource as RelatedPerson);
        if (pn) {
          rpPhoneNumbers.add(pn);
          const mapVal = phoneNumberToRpMap[pn] ?? [];
          mapVal.push(`RelatedPerson/${resource.id}`);
          phoneNumberToRpMap[pn] = mapVal;
        }
      });
      const comms: Communication[] = communications.filter(
        (resource) => resource.resourceType === 'Communication',
      ) as Communication[];

      comms.forEach((comm) => {
        const { sender } = comm;
        if (sender && sender.reference) {
          const rpRef = sender.reference;
          const senderResource = rpIdToResourceMap[rpRef];
          if (senderResource && getSMSNumberForIndividual(senderResource)) {
            const smsNumber = getSMSNumberForIndividual(senderResource);
            const allRPsWithThisNumber = phoneNumberToRpMap[smsNumber ?? ''] ?? [];
            allRPsWithThisNumber.forEach((rp) => {
              const commArray = rpToCommMap[rp] ?? [];
              commArray.push(comm);
              rpToCommMap[rp] = commArray;
            });
          }
        }
      });
    }

    console.time('structure_appointment_data');
    let appointments: Appointment[] = [];
    if (visitType?.length > 0) {
      console.log(1, allAppointments.length);
      appointments = allAppointments?.filter((appointment) => {
        return visitType?.includes(appointment.appointmentType?.text || '');
      });
    } else {
      appointments = allAppointments;
    }

    if (appointments.length > 0) {
      const appointmentQueues = sortAppointments(appointments, getSecret(SecretsKeys.ENVIRONMENT, secrets));
      const baseMapInput: Omit<AppointmentInformationInputs, 'appointment'> = {
        timezone,
        encounterRefToQRMap,
        patientRefToQRMap,
        patientToRPMap,
        allDocRefs,
        apptRefToEncounterMap,
        patientIdMap,
        rpToCommMap,
        next: false,
      };

      preBooked = appointmentQueues.prebooked
        .map((appointment) => {
          return makeAppointmentInformation({
            appointment,
            ...baseMapInput,
          });
        })
        .filter(isTruthy);
      inOffice = [
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
      ].filter(isTruthy);
      completed = appointmentQueues.checkedOut
        .map((appointment) => {
          return makeAppointmentInformation({
            appointment,
            ...baseMapInput,
          });
        })
        .filter(isTruthy);
      canceled = appointmentQueues.canceled
        .map((appointment) => {
          return makeAppointmentInformation({
            appointment,
            ...baseMapInput,
          });
        })
        .filter(isTruthy);
    }

    const response = {
      activeApptDatesBeforeToday: activeAppointmentDatesBeforeToday.filter(
        (value, index, array) => array.indexOf(value) === index,
      ), // remove duplicate dates
      message: 'Successfully retrieved all appointments',
      preBooked,
      inOffice,
      completed,
      cancelled: canceled, // grrr
    };
    console.timeEnd('structure_appointment_data');

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

interface AppointmentInformationInputs {
  appointment: Appointment;
  patientIdMap: Record<string, Patient>;
  apptRefToEncounterMap: Record<string, Encounter>;
  encounterRefToQRMap: Record<string, QuestionnaireResponse>;
  patientRefToQRMap: Record<string, QuestionnaireResponse>;
  patientToRPMap: Record<string, RelatedPerson[]>;
  rpToCommMap: Record<string, Communication[]>;
  allDocRefs: DocumentReference[];
  timezone: string | undefined;
  next: boolean;
}

const makeAppointmentInformation = (input: AppointmentInformationInputs): UCAppointmentInformation | undefined => {
  const {
    appointment,
    timezone,
    patientIdMap,
    apptRefToEncounterMap,
    encounterRefToQRMap,
    allDocRefs,
    rpToCommMap,
    next,
    patientToRPMap,
  } = input;

  // console.log('rp to comm map', JSON.stringify(Object.keys(rpToCommMap)));

  const patientRef = appointment.participant.find((appt) => appt.actor?.reference?.startsWith('Patient/'))?.actor
    ?.reference;
  const patientId = patientRef?.replace('Patient/', '');
  const patient = patientId ? patientIdMap[patientId] : undefined;

  if (!patient) {
    // returning undefined cause on frontend there will be an error if patient is undefined anyway
    // it was a potential bug when there were different types in frontend and backend for the same appointment entity
    return undefined;
  }
  const encounter = apptRefToEncounterMap[`Appointment/${appointment.id}`];
  const questionnaireResponse = encounterRefToQRMap[`Encounter/${encounter?.id}`];

  let smsModel: SMSModel | undefined;

  if (patientRef) {
    let rps: RelatedPerson[] = [];
    try {
      // some slack alerts suggest this could be undefined, but that would mean there are patients with no RP
      // or some bug preventing rp from being returned with the query
      rps = patientToRPMap[patientRef];
      const recipients = rps
        .map((rp) => {
          return {
            relatedPersonId: rp.id,
            smsNumber: getSMSNumberForIndividual(rp),
          };
        })
        .filter((rec) => rec.relatedPersonId !== undefined && rec.smsNumber !== undefined) as SMSRecipient[];
      if (recipients.length) {
        // console.log('recipients', recipients);
        const allComs = recipients.flatMap((recip) => {
          // console.log(`com map key: RelatedPerson/${recip.relatedPersonId}`);
          return rpToCommMap[`RelatedPerson/${recip.relatedPersonId}`] ?? [];
        });
        smsModel = {
          hasUnreadMessages: getChatContainsUnreadMessages(allComs),
          recipients,
        };
      }
    } catch (e) {
      console.log('error building sms model: ', e);
      console.log('related persons value prior to error: ', rps);
    }
  }

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

  const unconfirmedDOB = getUnconfirmedDOBForAppointment(appointment);

  const waitingMinutesString = appointment.meta?.tag?.find((tag) => tag.system === 'waiting-minutes-estimate')?.code;
  const waitingMinutes = waitingMinutesString ? parseInt(waitingMinutesString) : undefined;

  const ovrpInterest = questionnaireResponse?.item?.find(
    (response: QuestionnaireResponseItem) => response.linkId === 'ovrp-interest',
  )?.answer?.[0]?.valueString;

  return {
    id: appointment.id!,
    start: DateTime.fromISO(appointment.start!).setZone(timezone).toISO() || 'Unknown',
    patient: {
      id: patient.id!,
      firstName: patient?.name?.[0].given?.[0] || 'Unknown',
      lastName: patient?.name?.[0].family || 'Unknown',
      dateOfBirth: patient?.birthDate || 'Unknown',
    },
    smsModel,
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
      ovrpInterest: ovrpInterest === 'Yes',
    },
    next,
    visitStatusHistory: getVisitStatusHistory(appointment),
    needsDOBConfirmation: !!unconfirmedDOB,
    waitingMinutes,
  };
};
