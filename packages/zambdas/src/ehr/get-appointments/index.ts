import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Communication,
  DocumentReference,
  Encounter,
  HealthcareService,
  Location,
  Patient,
  Person,
  Practitioner,
  Provenance,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  appointmentAttendanceTypeAppointment,
  AppointmentRelatedResources,
  appointmentTypeForAppointment,
  CONSENT_FORMS_CONFIG,
  flattenItems,
  GetAppointmentsZambdaInput,
  getAttendingPractitionerId,
  getAttestedConsentFromEncounter,
  getChatContainsUnreadMessages,
  getCoding,
  getMiddleName,
  getPatientFirstName,
  getPatientLastName,
  getSMSNumberForIndividual,
  getVisitStatusHistory,
  InPersonAppointmentInformation,
  INSURANCE_CARD_CODE,
  isAnnotationFollowupEncounter,
  isInPersonAppointment,
  isNonPaperworkQuestionnaireResponse,
  isPatientDemographicsComplete,
  isTruthy,
  PHOTO_ID_CARD_CODE,
  PRIVATE_EXTENSION_BASE_URL,
  ROOM_EXTENSION_URL,
  Secrets,
  SERVICE_CATEGORY_SYSTEM,
  SMSModel,
  SMSRecipient,
  TIMEZONE_EXTENSION_URL,
  ZAP_SMS_MEDIUM_CODE,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getTrackingBoardVisitStatus,
  sortAppointments,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getPersonPhone } from '../patient-account/get-login-phone-numbers';
import {
  getAppointmentQueryInput,
  getTimezoneResourceIdFromAppointment,
  makeEncounterSearchParams,
  makeResourceCacheKey,
  mergeResources,
  parseAttenderProviderType,
  parseEncounterParticipants,
  timezoneMap,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetAppointmentsZambdaInputValidated extends GetAppointmentsZambdaInput {
  supervisorApprovalEnabled: boolean;
  secrets: Secrets | null;
}

const getNextPartitionKey = (appointment: InPersonAppointmentInformation, bucket: string): string => {
  const locationTimezone = appointment.location?.extension?.find(
    (extension) => extension.url === TIMEZONE_EXTENSION_URL
  )?.valueString;
  // makeAppointmentInformation already zones appointment.start to the appointment's own timezone, so
  // preserving its embedded offset (setZone: true) keeps locationless provider/group rows on their
  // real local day. An explicit location timezone, when present, takes precedence.
  const startDateTime = DateTime.fromISO(appointment.start, { setZone: true });
  const zonedStart = locationTimezone ? startDateTime.setZone(locationTimezone) : startDateTime;
  const localDate = zonedStart.toISODate() ?? 'unknown-day';
  // `group` is a display name rather than an id, but it is only a fallback key when no location id
  // is present; a name collision here is harmless (it would only over-share the "next" flag).
  const locationKey = appointment.location?.id ?? appointment.group ?? 'unknown-location';

  return [bucket, locationKey, localDate].join(':');
};

// Mutates `next` in place: these appointment objects are freshly built by makeAppointmentInformation
// and not shared anywhere, so cloning each one would only add allocations.
export const assignNextFlagsByPartition = (
  appointments: InPersonAppointmentInformation[],
  bucket: string
): InPersonAppointmentInformation[] => {
  const seenPartitions = new Set<string>();

  return appointments.map((appointment) => {
    const partitionKey = getNextPartitionKey(appointment, bucket);
    appointment.next = !seenPartitions.has(partitionKey);
    seenPartitions.add(partitionKey);

    return appointment;
  });
};

const isUserRelatedPerson = (rp: RelatedPerson): boolean =>
  getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson';

let m2mToken: string;

export const index = wrapHandler('get-appointments', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);

  // Appointment dates in the resource are stored in Zulu (UTC) format:
  // "start": "2025-03-21T00:15:00.000Z",
  // "end": "2025-03-21T00:30:00.000Z",
  // But in local time (e.g., America/New_York) this may actually be 2025-03-20.
  // We should use the supplied timezone to request the correct appointments.
  // The approach: use date with timezone from client and convert it to a range of date-time in Zulu (UTC)
  const {
    visitType,
    searchDateFrom,
    searchDateTo,
    timezone,
    locationIds,
    providerIds,
    serviceCategories,
    supervisorApprovalEnabled,
    secrets,
  } = validatedParameters;

  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  console.time('get_active_encounters + get_appointment_data');

  const requestedTimezoneRelatedResources: {
    resourceId: string;
    resourceType: 'Location' | 'Practitioner';
  }[] = (() => {
    const resources: { resourceId: string; resourceType: 'Location' | 'Practitioner' }[] = [];

    if (locationIds) {
      resources.push(
        ...locationIds.map((locationId) => ({ resourceId: locationId, resourceType: 'Location' }) as const)
      );
    }

    if (providerIds) {
      resources.push(
        ...providerIds.map((providerId) => ({ resourceId: providerId, resourceType: 'Practitioner' }) as const)
      );
    }

    return resources;
  })();

  const { appointmentResources, appointmentsToGroupMap } = await (async () => {
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
          searchDateFrom,
          searchDateTo,
          timezone,
        });

        const appointmentRequest = {
          resourceType: appointmentRequestInput.resourceType,
          params: appointmentRequestInput.params,
        };

        const { group } = appointmentRequestInput;

        const appointmentBundle =
          await oystehr.fhir.searchAndGetAllPages<AppointmentRelatedResources>(appointmentRequest);

        const appointments = (appointmentBundle.entry?.map((entry) => entry.resource).filter(isTruthy) ?? []).filter(
          (resource) => !isNonPaperworkQuestionnaireResponse(resource)
        );

        return { appointments, group };
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

    return {
      appointmentResources: mergeResources(flatAppointments),
      appointmentsToGroupMap,
    };
  })();

  console.timeEnd('get_active_encounters + get_appointment_data');

  let preBooked: InPersonAppointmentInformation[] = [];
  let inOffice: InPersonAppointmentInformation[] = [];
  let completed: InPersonAppointmentInformation[] = [];
  let cancelled: InPersonAppointmentInformation[] = [];

  if (appointmentResources?.length == 0) {
    const response = {
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

  console.time('parse_search_results');

  const patientIds: string[] = [];
  const practitionerIds: string[] = [];
  const patientToRPMap: Record<string, RelatedPerson[]> = {};

  const allAppointments: Appointment[] = [];
  const patientIdMap: Record<string, Patient> = {};
  const apptRefToEncounterMap: Record<string, Encounter> = {};
  const encounterRefToQRMap: Record<string, QuestionnaireResponse> = {};
  const patientRefToQRMap: Record<string, QuestionnaireResponse> = {};
  const rpToCommMap: Record<string, Communication[]> = {};
  const rpPhoneNumbers = new Set<string>();
  const phoneNumberToRpMap: Record<string, Set<string>> = {};
  const rpToPhoneNumbersMap: Record<string, Set<string>> = {};
  const rpIdToResourceMap: Record<string, RelatedPerson> = {};
  const practitionerIdToResourceMap: Record<string, Practitioner> = {};
  const healthcareServiceIdToResourceMap: Record<string, HealthcareService> = {};
  const locationIdToResourceMap: Record<string, Location> = {};

  appointmentResources.forEach((resource) => {
    if (resource.resourceType === 'Appointment') {
      allAppointments.push(resource as Appointment);

      const appointment = resource as Appointment;
      const patientId = appointment.participant
        .find((appt) => appt.actor?.reference?.startsWith('Patient/'))
        ?.actor?.reference?.replace('Patient/', '');
      if (patientId) patientIds.push(`Patient/${patientId}`);
    } else if (resource.resourceType === 'Patient' && resource.id) {
      patientIdMap[resource.id] = resource as Patient;
    } else if (resource.resourceType === 'Encounter' && !isAnnotationFollowupEncounter(resource as Encounter)) {
      const asEnc = resource as Encounter;
      const apptRef = asEnc.appointment?.[0].reference;
      if (apptRef) {
        apptRefToEncounterMap[apptRef] = asEnc;
      }

      (asEnc.participant ?? []).forEach((p) => {
        const ref = p.individual?.reference;
        if (ref?.startsWith('Practitioner/')) {
          const id = ref.split('/')[1];
          if (id) practitionerIds.push(id);
        }
      });
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
      const rp = resource as RelatedPerson;
      if (!isUserRelatedPerson(rp)) return;

      const rpRef = `RelatedPerson/${rp.id}`;
      rpIdToResourceMap[rpRef] = rp;

      const patientRef = rp.patient?.reference;
      if (patientRef) {
        (patientToRPMap[patientRef] ??= []).push(rp);
      }

      const pn = getSMSNumberForIndividual(rp);
      if (pn) {
        rpPhoneNumbers.add(pn);
        (phoneNumberToRpMap[pn] ??= new Set<string>()).add(rpRef);
        (rpToPhoneNumbersMap[rpRef] ??= new Set<string>()).add(pn);
      }
    } else if (resource.resourceType === 'Practitioner' && resource.id) {
      practitionerIdToResourceMap[`Practitioner/${resource.id}`] = resource as Practitioner;
    } else if (resource.resourceType === 'HealthcareService' && resource.id) {
      healthcareServiceIdToResourceMap[`HealthcareService/${resource.id}`] = resource as HealthcareService;
    } else if (resource.resourceType === 'Location' && resource.id) {
      locationIdToResourceMap[`Location/${resource.id}`] = resource as Location;
    } else if (resource.resourceType === 'Person') {
      const person = resource as Person;

      const phone = getPersonPhone(person);
      if (!phone) return;

      person.link?.forEach((link) => {
        const rpRef = link.target?.reference;

        if (!rpRef?.startsWith('RelatedPerson/')) return;

        rpPhoneNumbers.add(phone);
        (phoneNumberToRpMap[phone] ??= new Set<string>()).add(rpRef);
        (rpToPhoneNumbersMap[rpRef] ??= new Set<string>()).add(phone);
      });
    }
  });

  console.timeEnd('parse_search_results');

  // Fallback: the main search's `_revinclude:iterate: RelatedPerson:patient` can silently
  // miss RPs, so narrow direct query for the matched patients.
  // Must run before the Communications search so any newly surfaced phones make it into
  // the `sender:RelatedPerson.telecom` filter.
  console.time('related_persons_fallback');
  if (patientIds.length > 0) {
    const rpBundle = await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [
        { name: 'patient', value: patientIds.join(',') },
        { name: 'relationship', value: 'user-relatedperson' },
      ],
    });
    rpBundle.unbundle().forEach((rp) => {
      if (!rp.id || !isUserRelatedPerson(rp)) return;
      const rpRef = `RelatedPerson/${rp.id}`;
      if (rpIdToResourceMap[rpRef]) return;

      rpIdToResourceMap[rpRef] = rp;

      const patientRef = rp.patient?.reference;
      if (patientRef) {
        (patientToRPMap[patientRef] ??= []).push(rp);
      }

      const pn = getSMSNumberForIndividual(rp);
      if (pn) {
        rpPhoneNumbers.add(pn);
        (phoneNumberToRpMap[pn] ??= new Set<string>()).add(rpRef);
        (rpToPhoneNumbersMap[rpRef] ??= new Set<string>()).add(pn);
      }
    });
  }
  console.timeEnd('related_persons_fallback');

  console.time('get_all_doc_refs + get_all_communications + practitioners + signatures');
  const docRefPromise =
    patientIds.length > 0
      ? oystehr?.fhir.search<DocumentReference>({
          resourceType: 'DocumentReference',
          params: [
            { name: 'status', value: 'current' },
            { name: 'type', value: `${INSURANCE_CARD_CODE},${PHOTO_ID_CARD_CODE}` },
            { name: 'related', value: patientIds.join(',') },
          ],
        })
      : Promise.resolve(undefined);
  const uniqueNumbers = Array.from(rpPhoneNumbers);

  let allDocRefs: DocumentReference[] | undefined = undefined;
  let communications: (Communication | RelatedPerson)[] | undefined = undefined;
  let encounterSignatures: Provenance[] | undefined = undefined;

  const communicationsPromise =
    uniqueNumbers.length > 0
      ? oystehr.fhir.search<Communication | RelatedPerson>({
          resourceType: 'Communication',
          params: [
            { name: 'medium', value: `${ZAP_SMS_MEDIUM_CODE}` },
            { name: 'sender:RelatedPerson.telecom', value: uniqueNumbers.join(',') },
            { name: '_include', value: 'Communication:sender' },
          ],
        })
      : Promise.resolve(undefined);

  const participantsPromise =
    practitionerIds.length > 0
      ? oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [{ name: '_id', value: practitionerIds.join(',') }],
        })
      : Promise.resolve(undefined);

  const encounterIds = Object.values(apptRefToEncounterMap)
    .filter(Boolean)
    .map((enc) => enc.id)
    .filter(isTruthy);

  const provenancePromises = encounterIds.map((encId) =>
    oystehr.fhir.search<Provenance>({
      resourceType: 'Provenance',
      params: [
        { name: 'target', value: `Encounter/${encId}` },
        { name: 'agent-role', value: 'verifier' },
      ],
    })
  );

  const [docRefBundle, communicationBundle, participantsBundle, ...encounterSignaturesBundle] = await Promise.all([
    docRefPromise,
    communicationsPromise,
    participantsPromise,
    ...provenancePromises,
  ]);

  allDocRefs = docRefBundle?.unbundle() ?? [];
  communications = communicationBundle?.unbundle();
  const practitioners = participantsBundle?.unbundle() as Practitioner[];
  practitioners?.forEach((pr) => {
    practitionerIdToResourceMap[`Practitioner/${pr.id}`] = pr;
  });

  encounterSignatures = encounterSignaturesBundle.flatMap((bundle) => bundle?.unbundle() ?? []);

  console.timeEnd('get_all_doc_refs + get_all_communications + practitioners + signatures');

  // For follow-up appointments, the parent encounter is typically not in the current search results.
  // Batch-fetch any parent encounters that are referenced via partOf but missing from apptRefToEncounterMap.
  const existingEncounterRefs = new Set(Object.values(apptRefToEncounterMap).map((enc) => `Encounter/${enc.id}`));
  const missingParentEncounterRefs = [
    ...new Set(
      Object.values(apptRefToEncounterMap)
        .filter((enc) => enc.partOf?.reference && !existingEncounterRefs.has(enc.partOf.reference))
        .map((enc) => enc.partOf!.reference!)
    ),
  ];

  const parentEncounterToApptIdMap: Record<string, string> = {};
  if (missingParentEncounterRefs.length > 0) {
    const ids = missingParentEncounterRefs.map((ref) => ref.replace('Encounter/', '')).join(',');
    const parentEncounters =
      (
        await oystehr.fhir.search<Encounter>({
          resourceType: 'Encounter',
          params: [{ name: '_id', value: ids }],
        })
      )?.unbundle() ?? [];
    parentEncounters.forEach((enc) => {
      const apptRef = enc.appointment?.[0]?.reference;
      if (enc.id && apptRef) {
        parentEncounterToApptIdMap[`Encounter/${enc.id}`] = apptRef.replace('Appointment/', '');
      }
    });
  }

  // because the related person tied to the user's account has been excluded from the graph of persons
  // connected to patient resources, while the Zap sms creates communications with sender reference based on
  // the user's profile-linked resource, it is necessary to do this cross-referencing to map from the sender resource
  // on sms Communication resources to the related person list associated with each patient
  // this cuts around 3 seconds off the execution time for this zambda, or more when there are no results
  if (communications && communications.length > 0) {
    const commSenders: RelatedPerson[] = communications.filter(
      (resource) => resource.resourceType === 'RelatedPerson'
    ) as RelatedPerson[];
    commSenders.forEach((rp) => {
      if (!rp.id) return;
      if (!isUserRelatedPerson(rp)) return;
      const rpRef = `RelatedPerson/${rp.id}`;
      rpIdToResourceMap[rpRef] = rp;
      const pn = getSMSNumberForIndividual(rp);
      if (pn) {
        rpPhoneNumbers.add(pn);
        (phoneNumberToRpMap[pn] ??= new Set<string>()).add(rpRef);
        (rpToPhoneNumbersMap[rpRef] ??= new Set<string>()).add(pn);
      }
    });
    const comms: Communication[] = communications.filter(
      (resource) => resource.resourceType === 'Communication'
    ) as Communication[];

    comms.forEach((comm) => {
      const rpRef = comm.sender?.reference;
      if (!rpRef) return;
      const senderResource = rpIdToResourceMap[rpRef];
      if (!senderResource) return;
      const smsNumber = getSMSNumberForIndividual(senderResource);
      if (!smsNumber) return;
      phoneNumberToRpMap[smsNumber]?.forEach((rp) => {
        (rpToCommMap[rp] ??= []).push(comm);
      });
    });
  }

  console.time('structure_appointment_data');
  let appointments: Appointment[] = allAppointments;

  if (visitType?.length > 0) {
    appointments = appointments?.filter((appointment) => {
      return visitType?.includes(
        (isInPersonAppointment(appointment) ? 'in-person-' : 'virtual-') + appointmentTypeForAppointment(appointment)
      );
    });
  }

  if (serviceCategories != null && serviceCategories?.length > 0) {
    appointments = appointments?.filter((appointment) => {
      const appointmentServiceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
      return appointmentServiceCategory && serviceCategories?.includes(appointmentServiceCategory);
    });
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
      rpToPhoneNumbersMap,
      practitionerIdToResourceMap,
      healthcareServiceIdToResourceMap,
      next: false,
      group: undefined,
      supervisorApprovalEnabled,
      encounterSignatures,
      locationIdToResourceMap,
      parentEncounterToApptIdMap,
    };

    const buildAppointments = (queue: Appointment[]): InPersonAppointmentInformation[] =>
      queue
        .map((appointment) =>
          makeAppointmentInformation(oystehr, {
            appointment,
            ...baseMapInput,
            group: appointmentsToGroupMap.get(appointment.id ?? ''),
          })
        )
        .filter(isTruthy);

    preBooked = buildAppointments(appointmentQueues.prebooked);

    inOffice = [
      ...assignNextFlagsByPartition(buildAppointments(appointmentQueues.inOffice.waitingRoom.arrived), 'arrived'),
      ...assignNextFlagsByPartition(buildAppointments(appointmentQueues.inOffice.waitingRoom.ready), 'ready'),
      ...buildAppointments(appointmentQueues.inOffice.inExam.intake),
      ...assignNextFlagsByPartition(
        buildAppointments(appointmentQueues.inOffice.inExam['ready for provider']),
        'ready-for-provider'
      ),
      ...buildAppointments(appointmentQueues.inOffice.inExam.provider),
    ];

    completed = buildAppointments(appointmentQueues.checkedOut);
    cancelled = buildAppointments(appointmentQueues.canceled);
  }

  const response = {
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
});

interface AppointmentInformationInputs {
  appointment: Appointment;
  patientIdMap: Record<string, Patient>;
  apptRefToEncounterMap: Record<string, Encounter>;
  encounterRefToQRMap: Record<string, QuestionnaireResponse>;
  patientRefToQRMap: Record<string, QuestionnaireResponse>;
  patientToRPMap: Record<string, RelatedPerson[]>;
  rpToCommMap: Record<string, Communication[]>;
  rpToPhoneNumbersMap: Record<string, Set<string>>;
  practitionerIdToResourceMap: Record<string, Practitioner>;
  healthcareServiceIdToResourceMap: Record<string, HealthcareService>;
  allDocRefs: DocumentReference[];
  next: boolean;
  group: HealthcareService | undefined;
  supervisorApprovalEnabled: boolean;
  encounterSignatures: Provenance[];
  locationIdToResourceMap: Record<string, Location>;
  parentEncounterToApptIdMap: Record<string, string>;
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
    next,
    patientToRPMap,
    rpToPhoneNumbersMap,
    group,
    supervisorApprovalEnabled,
    encounterSignatures,
    locationIdToResourceMap,
    parentEncounterToApptIdMap,
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
    try {
      const rps = patientToRPMap[patientRef] ?? [];
      const recipientsMap = new Map<string, SMSRecipient>();

      rps.forEach((rp) => {
        const rpRef = `RelatedPerson/${rp.id}`;
        const phones = rpToPhoneNumbersMap[rpRef] ?? new Set<string>();

        phones.forEach((phone) => {
          const key = `${rpRef}|${phone}`;
          if (!recipientsMap.has(key)) {
            recipientsMap.set(key, {
              recipientResourceUri: rpRef,
              smsNumber: phone,
            });
          }
        });
      });

      const recipients = Array.from(recipientsMap.values());
      if (recipients.length === 0) {
        throw new Error(`no RelatedPerson with contact number for patient ${patientId}`);
      }

      const allCommunications = recipients.flatMap((recipient) => {
        return rpToCommMap[recipient.recipientResourceUri] ?? [];
      });
      smsModel = {
        hasUnreadMessages: getChatContainsUnreadMessages(allCommunications),
        recipients,
      };
    } catch (e) {
      console.log('error building sms model: ', e);
      captureException(e);
    }
  } else {
    console.log(`no patient ref found for appointment ${appointment.id}`);
  }

  const flattenedItems = flattenItems(questionnaireResponse?.item ?? []);
  const consentComplete =
    CONSENT_FORMS_CONFIG.forms.every(
      (form) =>
        flattenedItems.find((item: { linkId: string }) => item.linkId === form.id)?.answer?.[0]?.valueBoolean === true
    ) &&
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
  const status = getTrackingBoardVisitStatus(appointment, encounter, supervisorApprovalEnabled);

  const waitingMinutesString = appointment.meta?.tag?.find((tag) => tag.system === 'waiting-minutes-estimate')?.code;
  const waitingMinutes = waitingMinutesString ? parseInt(waitingMinutesString) : undefined;

  const ovrpInterest = flattenedItems.find((response: QuestionnaireResponseItem) => response.linkId === 'ovrp-interest')
    ?.answer?.[0]?.valueString;

  const practitionerId = getAttendingPractitionerId(encounter);
  const practitioner = practitionerIdToResourceMap[`Practitioner/${practitionerId}`];
  let provider = '';
  if (practitioner && practitioner.name) {
    provider = oystehr.fhir.formatHumanName(practitioner.name[0]);
  }

  // if the QR has been updated at least once, this tag will not be present
  const demographicsByPaperworkSubmission = !!questionnaireResponse?.authored;

  const demographicsByPatientResource = isPatientDemographicsComplete(patient);
  const consentByPaperworkSignatures = !!consentComplete;
  const consentByStaffAttestation = !!(encounter && getAttestedConsentFromEncounter(encounter));

  const participants = parseEncounterParticipants(encounter, practitionerIdToResourceMap);
  const attenderProviderType = parseAttenderProviderType(encounter, practitionerIdToResourceMap);
  const signature = encounterSignatures.find((provenance) =>
    provenance.target.find((ref) => ref.reference === `Encounter/${encounter.id}`)
  );
  const approvalDate = signature?.recorded;
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
    appointmentType: appointmentTypeForAppointment(appointment),
    appointmentAttendanceType: appointmentAttendanceTypeAppointment(appointment),
    appointmentStatus: appointment.status,
    status,
    cancellationReason: cancellationReason,
    provider: provider,
    attenderProviderType,
    approvalDate,
    group: group ? group.name : undefined,
    room: room,
    paperwork: {
      demographics: demographicsByPaperworkSubmission || demographicsByPatientResource,
      photoID: idCard,
      insuranceCard: insuranceCard,
      consent: consentByPaperworkSignatures || consentByStaffAttestation,
      ovrpInterest: Boolean(ovrpInterest && ovrpInterest.startsWith('Yes')),
    },
    participants,
    next,
    visitStatusHistory: getVisitStatusHistory(encounter),
    waitingMinutes,
    // Prefer the human-readable display, but fall back to the code: FHIR-backed
    // (non-system) categories are stamped on the slot with only system+code and
    // no display, so without this the abbreviation resolver gets nothing.
    serviceCategory: (() => {
      const coding = appointment.serviceCategory
        ?.flatMap((codeableConcept) => codeableConcept.coding ?? [])
        ?.find((c) => c.system === SERVICE_CATEGORY_SYSTEM);
      return coding?.display ?? coding?.code;
    })(),
    location: locationIdToResourceMap[encounter.location?.[0]?.location?.reference ?? ''],
    isFollowUp: !!encounter.partOf,
    parentEncounterId: encounter.partOf?.reference?.replace('Encounter/', ''),
    parentAppointmentId: encounter.partOf?.reference
      ? Object.entries(apptRefToEncounterMap)
          .find(([, enc]) => `Encounter/${enc.id}` === encounter.partOf?.reference)?.[0]
          ?.replace('Appointment/', '') ?? parentEncounterToApptIdMap[encounter.partOf.reference]
      : undefined,
  };
};
