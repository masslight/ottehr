import Oystehr, { Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Communication,
  DocumentReference,
  Encounter,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentRelatedResources,
  INSURANCE_CARD_CODE,
  InPersonAppointmentInformation,
  OTTEHR_MODULE,
  PHOTO_ID_CARD_CODE,
  SMSModel,
  SMSRecipient,
  ZAP_SMS_MEDIUM_CODE,
  appointmentTypeForAppointment,
  flattenItems,
  getChatContainsUnreadMessages,
  getMiddleName,
  getPatientFirstName,
  getPatientLastName,
  getSMSNumberForIndividual,
  getUnconfirmedDOBForAppointment,
  getVisitStatus,
  getVisitStatusHistory,
  isTruthy,
} from 'utils';
import { Secrets, ZambdaInput } from 'zambda-utils';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken, createOystehrClient, getRelatedPersonsFromResourceList } from '../shared/helpers';
import { sortAppointments } from '../shared/queueingUtils';
import { getMergedResourcesFromBundles, parseEncounterParticipants } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetAppointmentsInput {
  searchDate: string;
  locationID?: string;
  providerIDs?: string[];
  groupIDs?: string[];
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
    const { visitType, searchDate, locationID, providerIDs, groupIDs, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);

    const oystehr = createOystehrClient(m2mtoken, secrets);
    let activeAppointmentDatesBeforeToday: string[] = [];
    let fhirLocation: Location | undefined = undefined;
    let timezone: string | undefined;
    if (locationID) {
      timezone = timezoneMap.get(locationID);
      console.log('timezone, map', timezone, JSON.stringify(timezoneMap));
      console.time('get-timezone');
      if (!timezone) {
        try {
          console.log(`reading location ${locationID}`);
          fhirLocation = await oystehr.fhir.get<Location>({
            resourceType: 'Location',
            id: locationID,
          });
          timezone = fhirLocation?.extension?.find(
            (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
          )?.valueString;
          if (timezone) {
            timezoneMap.set(locationID, timezone);
          }
          console.log('found location: ', fhirLocation.name);
        } catch (e) {
          console.log('error getting location', JSON.stringify(e));
          throw new Error('location is not found');
        }
      }
      console.timeEnd('get-timezone');
      console.log('timezone2, map2', timezone, timezoneMap);
    }

    console.time('get_active_encounters + get_appointment_data');

    const encounterSearchParams = [
      { name: '_count', value: '1000' },
      { name: '_include', value: 'Encounter:appointment' },
      {
        name: '_include',
        value: 'Encounter:participant',
      },
      { name: 'appointment._tag', value: OTTEHR_MODULE.IP }, // why is this restricted to in-person appointments
      { name: 'appointment.date', value: `lt${DateTime.now().setZone(timezone).startOf('day')}` },
      // { name: 'appointment.location', value: `Location/${locationId}` },
      { name: 'status:not', value: 'planned' },
      { name: 'status:not', value: 'finished' },
      { name: 'status:not', value: 'cancelled' },
    ];
    // console.log('encounter search params: ', JSON.stringify(encounterSearchParams, null, 2));
    if (locationID) {
      encounterSearchParams.push({ name: 'appointment.location', value: `Location/${locationID}` });
    }
    encounterSearchParams.push({
      name: 'appointment.date',
      value: `lt${DateTime.now().setZone(timezone).startOf('day')}`,
    });
    let cachedEncounterIds;
    const idMapKey = `${locationID}|${DateTime.now().setZone(timezone).startOf('day').toISODate()}`;

    if (locationID) {
      cachedEncounterIds = encounterIdMap.get(idMapKey);

      // if we have cached encounter ids, add them to the search for a big optimization boost
      if (cachedEncounterIds && cachedEncounterIds !== SKIP) {
        encounterSearchParams.push({
          name: '_id',
          value: cachedEncounterIds,
        });
      }
    }

    // if we know previous search turned up no problem encounters, skip this search entirely and
    // return an empty array. see note below where the rationale for this behavior is explained.
    let encounterSearch: Promise<Bundle<Encounter | Appointment | Practitioner>>;
    if (cachedEncounterIds === SKIP) {
      encounterSearch = new Promise((resolve, _) => {
        resolve({ resourceType: 'Bundle', type: 'collection', unbundle: () => [] });
      });
    } else {
      encounterSearch = oystehr.fhir.search<Encounter | Appointment | Practitioner>({
        resourceType: 'Encounter',
        params: encounterSearchParams,
      });
    }

    const searchDateWithTimezone = DateTime.fromISO(searchDate).setZone(timezone);
    const appointmentSearchParams = [
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
      { name: '_include', value: 'Appointment:actor' },
    ];

    const appointmentSearchQueries: Promise<Bundle<AppointmentRelatedResources>>[] = [];
    if (locationID) {
      const locationSearchParams = [
        ...appointmentSearchParams,
        {
          name: 'location',
          value: `Location/${locationID}`,
        },
      ];
      appointmentSearchQueries.push(
        oystehr.fhir.search<AppointmentRelatedResources>({
          resourceType: 'Appointment',
          params: locationSearchParams,
        })
      );
    }
    if (providerIDs && providerIDs?.length > 0) {
      const providerSearchParams = [
        ...appointmentSearchParams,
        {
          name: 'actor',
          value: providerIDs.map((providerID) => `Practitioner/${providerID}`).join(','),
        },
      ];
      appointmentSearchQueries.push(
        oystehr.fhir.search<AppointmentRelatedResources>({
          resourceType: 'Appointment',
          params: providerSearchParams,
        })
      );
    }
    if (groupIDs && groupIDs?.length > 0) {
      const groupSearchParams = [
        ...appointmentSearchParams,
        {
          name: 'actor',
          value: groupIDs.map((groupID) => `HealthcareService/${groupID}`).join(','),
        },
      ];
      appointmentSearchQueries.push(
        oystehr.fhir.search<AppointmentRelatedResources>({
          resourceType: 'Appointment',
          params: groupSearchParams,
        })
      );
    }

    if (appointmentSearchQueries.length === 0) {
      appointmentSearchQueries.push(
        oystehr.fhir.search<AppointmentRelatedResources>({
          resourceType: 'Appointment',
          params: appointmentSearchParams,
        })
      );
    }

    const [activeEncounterBundle, ...appointmentBundles] = await Promise.all([
      encounterSearch,
      ...appointmentSearchQueries,
    ]);
    const activeEncounters = activeEncounterBundle.unbundle();
    const searchResultsForSelectedDate = getMergedResourcesFromBundles(appointmentBundles);

    console.timeEnd('get_active_encounters + get_appointment_data');

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

    let preBooked: InPersonAppointmentInformation[] = [];
    let inOffice: InPersonAppointmentInformation[] = [];
    let completed: InPersonAppointmentInformation[] = [];
    let canceled: InPersonAppointmentInformation[] = [];

    if (searchResultsForSelectedDate?.length == 0) {
      const response = {
        activeApptDatesBeforeToday: activeAppointmentDatesBeforeToday.filter(
          (value, index, array) => array.indexOf(value) === index
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
    const practitionerIdToResourceMap: Record<string, Practitioner> = {};
    const participantIdToResorceMap: Record<string, Practitioner> = {};
    const healthcareServiceIdToResourceMap: Record<string, HealthcareService> = {};
    activeEncounters.forEach((resource) => {
      if (resource.resourceType === 'Practitioner' && resource.id) {
        participantIdToResorceMap[`Practitioner/${resource.id}`] = resource as Practitioner;
      }
    });
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
      } else if (resource.resourceType === 'Practitioner' && resource.id) {
        practitionerIdToResourceMap[`Practitioner/${resource.id}`] = resource as Practitioner;
      } else if (resource.resourceType === 'HealthcareService' && resource.id) {
        healthcareServiceIdToResourceMap[`HealthcareService/${resource.id}`] = resource as HealthcareService;
      }
    });
    console.timeEnd('parse_search_results');

    console.time('get_all_doc_refs + get_all_communications');
    const docRefPromise = oystehr?.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'status', value: 'current' },
        { name: 'type', value: `${INSURANCE_CARD_CODE},${PHOTO_ID_CARD_CODE}` },
        { name: 'related', value: patientIds.join(',') },
      ],
    });
    const uniqueNumbers = Array.from(rpPhoneNumbers);

    let allDocRefs: DocumentReference[] | undefined = undefined;
    let communications: (Communication | RelatedPerson)[] | undefined = undefined;

    if (uniqueNumbers?.length > 0) {
      const communicationsPromise = oystehr.fhir.search<Communication | RelatedPerson>({
        resourceType: 'Communication',
        params: [
          { name: 'medium', value: `${ZAP_SMS_MEDIUM_CODE}` },
          { name: 'sender:RelatedPerson.telecom', value: uniqueNumbers.join(',') },
          { name: '_include', value: 'Communication:sender' },
        ],
      });
      const [docRefBundle, communicationBundle] = await Promise.all([docRefPromise, communicationsPromise]);
      allDocRefs = docRefBundle.unbundle();
      communications = communicationBundle.unbundle();
    } else {
      const docRefBundle = await docRefPromise;
      allDocRefs = docRefBundle.unbundle();
    }

    console.timeEnd('get_all_doc_refs + get_all_communications');

    // because the related person tied to the user's account has been excluded from the graph of persons
    // connected to patient resources, while the Zap sms creates communications with sender reference based on
    // the user's profile-linked resource, it is necessary to do this cross-referencing to map from the sender resource
    // on sms Communication resources to the related person list associated with each patient
    // this cuts around 3 seconds off the execution time for this zambda, or more when there are no results
    if (communications && communications.length > 0) {
      const commSenders: RelatedPerson[] = communications.filter(
        (resource) => resource.resourceType === 'RelatedPerson'
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
        (resource) => resource.resourceType === 'Communication'
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
      appointments = allAppointments?.filter((appointment) => {
        return visitType?.includes(appointmentTypeForAppointment(appointment));
      });
    } else {
      appointments = allAppointments;
    }

    if (appointments.length > 0) {
      const appointmentQueues = sortAppointments(appointments, apptRefToEncounterMap);
      const baseMapInput: Omit<AppointmentInformationInputs, 'appointment'> = {
        timezone,
        encounterRefToQRMap,
        patientRefToQRMap,
        patientToRPMap,
        allDocRefs,
        apptRefToEncounterMap,
        patientIdMap,
        rpToCommMap,
        practitionerIdToResourceMap,
        participantIdToResorceMap,
        healthcareServiceIdToResourceMap,
        next: false,
      };

      preBooked = appointmentQueues.prebooked
        .map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
          });
        })
        .filter(isTruthy);
      inOffice = [
        ...appointmentQueues.inOffice.waitingRoom.arrived.map((appointment, idx) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            next: idx === 0,
          });
        }),
        ...appointmentQueues.inOffice.waitingRoom.ready.map((appointment, idx) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            next: idx === 0,
          });
        }),
        ...appointmentQueues.inOffice.inExam.intake.map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
          });
        }),
        ...appointmentQueues.inOffice.inExam['ready for provider'].map((appointment, idx) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            next: idx === 0,
          });
        }),
        ...appointmentQueues.inOffice.inExam.provider.map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
          });
        }),
        ...appointmentQueues.inOffice.inExam['ready for discharge'].map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
          });
        }),
      ].filter(isTruthy);
      completed = appointmentQueues.checkedOut
        .map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
          });
        })
        .filter(isTruthy);
      canceled = appointmentQueues.canceled
        .map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
          });
        })
        .filter(isTruthy);
    }

    const response = {
      activeApptDatesBeforeToday: activeAppointmentDatesBeforeToday.filter(
        (value, index, array) => array.indexOf(value) === index
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
  practitionerIdToResourceMap: Record<string, Practitioner>;
  participantIdToResorceMap: Record<string, Practitioner>;
  healthcareServiceIdToResourceMap: Record<string, HealthcareService>;
  allDocRefs: DocumentReference[];
  timezone: string | undefined;
  next: boolean;
}

const makeAppointmentInformation = (
  oystehr: Oystehr,
  input: AppointmentInformationInputs
): InPersonAppointmentInformation | undefined => {
  const {
    appointment,
    timezone,
    patientIdMap,
    apptRefToEncounterMap,
    encounterRefToQRMap,
    allDocRefs,
    rpToCommMap,
    practitionerIdToResourceMap,
    participantIdToResorceMap,
    healthcareServiceIdToResourceMap,
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
    console.log(`no patient found for appointment ${appointment.id} with patient id ${patientId}`);
    return undefined;
  }
  const encounter = apptRefToEncounterMap[`Appointment/${appointment.id}`];
  const questionnaireResponse = encounterRefToQRMap[`Encounter/${encounter?.id}`];

  let smsModel: SMSModel | undefined;

  if (patientRef) {
    let rps: RelatedPerson[] = [];
    try {
      if (!(patientRef in patientToRPMap)) {
        throw new Error(`no related person found for patient ${patientId}`);
      }

      rps = patientToRPMap[patientRef];
      const recipients = rps
        .map((rp) => {
          return {
            recipientResourceUri: rp.id ? `RelatedPerson/${rp.id}` : undefined,
            smsNumber: getSMSNumberForIndividual(rp),
          };
        })
        .filter((rec) => rec.recipientResourceUri !== undefined && rec.smsNumber !== undefined) as SMSRecipient[];
      if (recipients.length) {
        // console.log('recipients', recipients);
        const allComs = recipients.flatMap((recip) => {
          // console.log(`com map key: RelatedPerson/${recip.relatedPersonId}`);
          return rpToCommMap[recip.recipientResourceUri] ?? [];
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
  } else {
    console.log(`no patient ref found for appointment ${appointment.id}`);
  }

  const flattenedItems = flattenItems(questionnaireResponse?.item ?? []);
  const consentComplete =
    flattenedItems.find((item: { linkId: string }) => item.linkId === 'hipaa-acknowledgement')?.answer?.[0]
      .valueBoolean === true &&
    flattenedItems.find((item: { linkId: string }) => item.linkId === 'consent-to-treat')?.answer?.[0].valueBoolean ===
      true &&
    flattenedItems.find((item: { linkId: string }) => item.linkId === 'signature') &&
    flattenedItems.find((item: { linkId: string }) => item.linkId === 'full-name') &&
    flattenedItems.find((item: { linkId: string }) => item.linkId === 'consent-form-signer-relationship');
  const docRefComplete = (type: string, frontTitle: string): boolean => {
    const docFound = allDocRefs.find(
      (document) =>
        document.context?.related?.find((related) => related.reference === `Patient/${patient?.id}`) &&
        document.type?.text === type
    );
    return !!docFound?.content.find((content) => content.attachment.title === frontTitle);
  };
  const idCard = docRefComplete('Photo ID cards', 'photo-id-front');
  const insuranceCard = docRefComplete('Insurance cards', 'insurance-card-front');
  const cancellationReason = appointment.cancelationReason?.coding?.[0].code;
  const status = getVisitStatus(appointment, encounter);

  const unconfirmedDOB = getUnconfirmedDOBForAppointment(appointment);

  const waitingMinutesString = appointment.meta?.tag?.find((tag) => tag.system === 'waiting-minutes-estimate')?.code;
  const waitingMinutes = waitingMinutesString ? parseInt(waitingMinutesString) : undefined;

  const ovrpInterest = flattenedItems.find((response: QuestionnaireResponseItem) => response.linkId === 'ovrp-interest')
    ?.answer?.[0]?.valueString;

  const provider = appointment.participant
    .filter((participant) => participant.actor?.reference?.startsWith('Practitioner/'))
    .map(function (practitionerTemp) {
      if (!practitionerTemp.actor?.reference) {
        return;
      }
      const practitioner = practitionerIdToResourceMap[practitionerTemp.actor.reference];
      console.log(1, practitionerIdToResourceMap);

      if (!practitioner.name) {
        return;
      }
      return oystehr.fhir.formatHumanName(practitioner.name[0]);
    })
    .join(', ');

  const group = appointment.participant
    .filter((participant) => participant.actor?.reference?.startsWith('HealthcareService/'))
    .map(function (groupTemp) {
      if (!groupTemp.actor?.reference) {
        return;
      }
      const group = healthcareServiceIdToResourceMap[groupTemp.actor.reference];
      console.log(1, healthcareServiceIdToResourceMap);

      if (!group.name) {
        return;
      }
      return group.name;
    })
    .join(', ');

  // if the QR has been updated at least once, this tag will not be present
  const paperworkHasBeenSubmitted = !!questionnaireResponse?.authored;

  const participants = parseEncounterParticipants(encounter, participantIdToResorceMap);

  return {
    id: appointment.id || 'Unknown',
    encounter,
    encounterId: encounter.id || 'Unknown',
    start: DateTime.fromISO(appointment.start!).setZone(timezone).toISO() || 'Unknown',
    patient: {
      id: patient.id || 'Unknown',
      firstName: getPatientFirstName(patient),
      lastName: getPatientLastName(patient),
      middleName: getMiddleName(patient),
      // suffix: patient?.name?.[0].suffix?.[0],
      sex: patient.gender,
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
    provider: provider,
    group: group,
    paperwork: {
      demographics: paperworkHasBeenSubmitted,
      photoID: idCard,
      insuranceCard: insuranceCard,
      consent: consentComplete ? true : false,
      ovrpInterest: Boolean(ovrpInterest && ovrpInterest.startsWith('Yes')),
    },
    participants,
    next,
    visitStatusHistory: getVisitStatusHistory(encounter),
    needsDOBConfirmation: !!unconfirmedDOB,
    waitingMinutes,
  };
};
