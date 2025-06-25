import Oystehr from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Communication,
  DocumentReference,
  Encounter,
  HealthcareService,
  Patient,
  Practitioner,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentRelatedResources,
  appointmentTypeForAppointment,
  flattenItems,
  GetAppointmentsZambdaInput,
  getChatContainsUnreadMessages,
  getMiddleName,
  getPatientFirstName,
  getPatientLastName,
  getSecret,
  getSMSNumberForIndividual,
  getUnconfirmedDOBForAppointment,
  getVisitStatus,
  getVisitStatusHistory,
  InPersonAppointmentInformation,
  INSURANCE_CARD_CODE,
  isTruthy,
  PHOTO_ID_CARD_CODE,
  ROOM_EXTENSION_URL,
  Secrets,
  SecretsKeys,
  SMSModel,
  SMSRecipient,
  ZAP_SMS_MEDIUM_CODE,
} from 'utils';
import { isNonPaperworkQuestionnaireResponse } from '../../common';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getRelatedPersonsFromResourceList,
  sortAppointments,
  topLevelCatch,
  ZambdaInput,
} from '../../shared';
import {
  getActiveAppointmentsBeforeTodayQueryInput,
  getAppointmentQueryInput,
  getTimezoneResourceIdFromAppointment,
  makeEncounterSearchParams,
  makeResourceCacheKey,
  mergeResources,
  parseEncounterParticipants,
  timezoneMap,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetAppointmentsZambdaInputValidated extends GetAppointmentsZambdaInput {
  secrets: Secrets | null;
}

let m2mToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);

    // Appointment dates in the resource are stored in Zulu (UTC) format:
    // "start": "2025-03-21T00:15:00.000Z",
    // "end": "2025-03-21T00:30:00.000Z",
    // But in local time (e.g., America/New_York) this may actually be 2025-03-20.
    // We should use the appointment's timezone to request the correct appointments.
    // The approach: use date without timezone from client and convert it to Zulu (UTC)
    // with the appointment's timezone.
    const { visitType, searchDate, locationID, providerIDs, groupIDs, secrets } = validatedParameters;

    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.time('get_active_encounters + get_appointment_data');

    const requestedTimezoneRelatedResources: {
      resourceId: string;
      resourceType: 'Location' | 'Practitioner' | 'HealthcareService';
    }[] = (() => {
      const resources: { resourceId: string; resourceType: 'Location' | 'Practitioner' | 'HealthcareService' }[] = [];

      if (locationID) {
        resources.push({ resourceId: locationID, resourceType: 'Location' });
      }

      if (providerIDs) {
        resources.push(
          ...providerIDs.map((providerID) => ({ resourceId: providerID, resourceType: 'Practitioner' }) as const)
        );
      }

      if (groupIDs) {
        resources.push(
          ...groupIDs.map((groupID) => ({ resourceId: groupID, resourceType: 'HealthcareService' }) as const)
        );
      }

      return resources;
    })();

    const { appointmentResources, activeApptsBeforeToday, appointmentsToGroupMap } = await (async () => {
      // prepare search options
      const searchOptions = await Promise.all(
        requestedTimezoneRelatedResources.map(async (resource) => {
          const cacheKey = makeResourceCacheKey({
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
          });

          const searchParams = await makeEncounterSearchParams({
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            cacheKey,
            oystehr,
          });

          return {
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            searchParams,
            cacheKey,
          };
        })
      );

      // request appointments
      const resourceResults = await Promise.all(
        searchOptions.map(async (options) => {
          const appointmentRequestInput = await getAppointmentQueryInput({
            oystehr,
            resourceId: options.resourceId,
            resourceType: options.resourceType,
            searchDate,
          });

          const appointmentRequest = {
            resourceType: appointmentRequestInput.resourceType,
            params: appointmentRequestInput.params,
          };

          const { group } = appointmentRequestInput;

          const activeApptsBeforeTodayRequest = await getActiveAppointmentsBeforeTodayQueryInput({
            oystehr,
            resourceId: options.resourceId,
            resourceType: options.resourceType,
          });

          const appointmentPromise = oystehr.fhir.search<AppointmentRelatedResources>(appointmentRequest);
          const activeApptsBeforeTodayPromise =
            oystehr.fhir.search<AppointmentRelatedResources>(activeApptsBeforeTodayRequest);

          const [appointmentResponse, activeApptsBeforeTodayResponse] = await Promise.all([
            appointmentPromise,
            activeApptsBeforeTodayPromise,
          ]);
          const appointments = appointmentResponse
            .unbundle()
            .filter((resource) => !isNonPaperworkQuestionnaireResponse(resource));

          const activeApptsBeforeTodayResources = activeApptsBeforeTodayResponse.unbundle();
          let activeApptsBeforeToday: Appointment[] = [];
          const activeApptsBeforeTodayPatientsIds: string[] = [];
          activeApptsBeforeTodayResources.forEach((res) => {
            if (res.resourceType === 'Appointment') activeApptsBeforeToday.push(res);
            if (res.resourceType === 'Patient' && res.id) activeApptsBeforeTodayPatientsIds.push(res.id);
          });

          // here we are checking if appointments-before-today have patients, because this issue appears a lot
          // and we can see date where we have appointment but nothing in waiting room because no patient for appointment
          activeApptsBeforeToday = activeApptsBeforeToday.filter((res) => {
            const patientRef = (res as Appointment).participant.find(
              (participant) => participant.actor?.reference?.startsWith('Patient/')
            )?.actor?.reference;
            const patientId = patientRef?.replace('Patient/', '') ?? '';
            return Boolean(activeApptsBeforeTodayPatientsIds.includes(patientId));
          });

          return { appointments, activeApptsBeforeToday, group };
        })
      );

      const appointmentsToGroupMap = new Map<string, HealthcareService>();

      const flatAppointments = resourceResults.flatMap((result) => {
        const appointments = result.appointments || [];
        const { group } = result;
        if (group) {
          appointments.forEach((appointment) => {
            appointmentsToGroupMap.set(`${appointment.id}`, group);
          });
        }
        return appointments;
      });

      const flatActiveApptsBeforeToday = resourceResults.flatMap((result) => {
        return result.activeApptsBeforeToday || [];
      });

      return {
        appointmentResources: mergeResources(flatAppointments),
        activeApptsBeforeToday: mergeResources(flatActiveApptsBeforeToday),
        appointmentsToGroupMap,
      };
    })();

    console.timeEnd('get_active_encounters + get_appointment_data');

    const activeAppointmentDatesBeforeToday = activeApptsBeforeToday
      .sort((r1, r2) => {
        const d1 = DateTime.fromISO((r1 as Appointment).start || '');
        const d2 = DateTime.fromISO((r2 as Appointment).start || '');
        return d1.diff(d2).toMillis();
      })
      .map((resource) => {
        const timezoneResourceId = getTimezoneResourceIdFromAppointment(resource as Appointment);
        const appointmentTimezone = timezoneResourceId && timezoneMap.get(timezoneResourceId);

        return DateTime.fromISO((resource as Appointment).start || '')
          .setZone(appointmentTimezone)
          .toFormat('MM/dd/yyyy');
      })
      .filter((date, index, array) => array.indexOf(date) === index); // filter duplicates

    let preBooked: InPersonAppointmentInformation[] = [];
    let inOffice: InPersonAppointmentInformation[] = [];
    let completed: InPersonAppointmentInformation[] = [];
    let cancelled: InPersonAppointmentInformation[] = [];

    if (appointmentResources?.length == 0) {
      const response = {
        activeApptDatesBeforeToday: activeAppointmentDatesBeforeToday,
        message: 'Successfully retrieved all appointments',
        preBooked,
        inOffice,
        completed,
        cancelled,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    // array of patient ids to get related documents
    const patientIds: string[] = [];
    appointmentResources.forEach((resource) => {
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
    const patientToRPMap: Record<string, RelatedPerson[]> = getRelatedPersonsFromResourceList(appointmentResources);

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
    appointmentResources.forEach((resource) => {
      if (resource.resourceType === 'Practitioner' && resource.id) {
        participantIdToResorceMap[`Practitioner/${resource.id}`] = resource as Practitioner;
      }
    });
    appointmentResources.forEach((resource) => {
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
        group: undefined,
      };

      preBooked = appointmentQueues.prebooked
        .map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        })
        .filter(isTruthy);
      inOffice = [
        ...appointmentQueues.inOffice.waitingRoom.arrived.map((appointment, idx) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            next: idx === 0,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        }),
        ...appointmentQueues.inOffice.waitingRoom.ready.map((appointment, idx) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            next: idx === 0,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        }),
        ...appointmentQueues.inOffice.inExam.intake.map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        }),
        ...appointmentQueues.inOffice.inExam['ready for provider'].map((appointment, idx) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            next: idx === 0,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        }),
        ...appointmentQueues.inOffice.inExam.provider.map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        }),
        ...appointmentQueues.inOffice.inExam['ready for discharge'].map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        }),
      ].filter(isTruthy);
      completed = appointmentQueues.checkedOut
        .map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        })
        .filter(isTruthy);
      cancelled = appointmentQueues.canceled
        .map((appointment) => {
          return makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          });
        })
        .filter(isTruthy);
    }

    const response = {
      activeApptDatesBeforeToday: activeAppointmentDatesBeforeToday,
      message: 'Successfully retrieved all appointments',
      preBooked,
      inOffice,
      completed,
      cancelled,
    };
    console.timeEnd('structure_appointment_data');

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('admin-get-appointments', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error getting patient appointments' }),
    };
  }
});

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
  next: boolean;
  group: HealthcareService | undefined;
}

const makeAppointmentInformation = (
  oystehr: Oystehr,
  input: AppointmentInformationInputs
): InPersonAppointmentInformation | undefined => {
  const {
    appointment,
    patientIdMap,
    apptRefToEncounterMap,
    encounterRefToQRMap,
    allDocRefs,
    rpToCommMap,
    practitionerIdToResourceMap,
    participantIdToResorceMap,
    next,
    patientToRPMap,
    group,
  } = input;

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
        const allComs = recipients.flatMap((recip) => {
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
    const docFound = allDocRefs.filter(
      (document) =>
        document.context?.related?.find((related) => related.reference === `Patient/${patient?.id}`) &&
        document.type?.text === type
    );
    return !!docFound.find((doc) => doc.content.find((content) => content.attachment.title === frontTitle));
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

  // if the QR has been updated at least once, this tag will not be present
  const paperworkHasBeenSubmitted = !!questionnaireResponse?.authored;

  const participants = parseEncounterParticipants(encounter, participantIdToResorceMap);

  const timezoneResourceId = getTimezoneResourceIdFromAppointment(appointment);
  const appointmentTimezone = timezoneResourceId && timezoneMap.get(timezoneResourceId);

  const room = appointment.extension?.find((ext) => ext.url === ROOM_EXTENSION_URL)?.valueString;

  return {
    id: appointment.id || 'Unknown',
    encounter,
    encounterId: encounter.id || 'Unknown',
    start: DateTime.fromISO(appointment.start!).setZone(appointmentTimezone).toISO() || 'Unknown',
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
    group: group ? group.name : undefined,
    room: room,
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
