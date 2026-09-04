import Oystehr, { Bundle } from '@oystehr/sdk';
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
import { appointmentAttendanceTypeAppointment, appointmentTypeForAppointment } from 'utils/lib/fhir/appointments';
import { chunkThings, getChatContainsUnreadMessages, ZAP_SMS_MEDIUM_CODE } from 'utils/lib/fhir/chat';
import {
  PRIVATE_EXTENSION_BASE_URL,
  ROOM_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { getAttestedConsentFromEncounter, getCoding } from 'utils/lib/fhir/helpers';
import { isInPersonAppointment } from 'utils/lib/fhir/moduleIdentification';
import {
  getMiddleName,
  getPatientFirstName,
  getPatientLastName,
  getSMSNumberForIndividual,
  isPatientDemographicsComplete,
} from 'utils/lib/fhir/patient';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { isNonPaperworkQuestionnaireResponse } from 'utils/lib/helpers/paperwork/paperwork';
import { flattenItems } from 'utils/lib/helpers/paperwork/validation';
import { CONSENT_FORMS_CONFIG } from 'utils/lib/ottehr-config/consent-forms';
import { getOptionalSecret, getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { GetAppointmentsZambdaInput, GetAppointmentsZambdaOutput } from 'utils/lib/types/api/get-appointments.types';
import { SMSModel, SMSRecipient } from 'utils/lib/types/api/messaging.types';
import {
  AppointmentRelatedResources,
  InPersonAppointmentInformation,
} from 'utils/lib/types/data/appointments/appointments.types';
import { INSURANCE_CARD_CODE, PHOTO_ID_CARD_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { APPOINTMENT_SEARCH_TOO_BROAD_ERROR } from 'utils/lib/types/errors';
import { isTruthy } from 'utils/lib/types/utils';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getTrackingBoardVisitStatus, sortAppointments } from '../../shared/queueingUtils';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { getVitalsEngineConfig } from '../../shared/vitals-alert-config';
import { getPersonPhone } from '../patient-account/get-login-phone-numbers';
import {
  getAppointmentQueryInput,
  getTimezone,
  getTimezoneResourceIdFromAppointment,
  isResponseSizeExceededError,
  mergeResources,
  parseAttenderProviderType,
  parseEncounterParticipants,
  timezoneMap,
} from './helpers';
import {
  buildTrackingBoardExtras,
  emptyTrackingBoardExtras,
  fetchTrackingBoardResources,
  selectTrackingBoardEncounterIds,
  selectVitalsPatientsByEncounterId,
  TrackingBoardResources,
} from './tracking-board';
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

// Provenances for the whole board are fetched with a comma-separated `target` OR list. The chunk
// size only bounds how large a single response can get; it is not a URL-length limit, since the SDK
// issues searches as POST bodies.
const PROVENANCE_SEARCH_CHUNK_SIZE = 100;

/** Visit type and service category are appointment-level filters, so they need nothing beyond the Appointment itself. */
const filterAppointmentsForBoard = (
  appointments: Appointment[],
  visitType: string[],
  serviceCategories: string[] | undefined
): Appointment[] => {
  let filtered = appointments;

  if (visitType?.length > 0) {
    filtered = filtered.filter((appointment) => {
      return visitType.includes(
        (isInPersonAppointment(appointment) ? 'in-person-' : 'virtual-') + appointmentTypeForAppointment(appointment)
      );
    });
  }

  if (serviceCategories != null && serviceCategories.length > 0) {
    filtered = filtered.filter((appointment) => {
      const appointmentServiceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
      return appointmentServiceCategory && serviceCategories.includes(appointmentServiceCategory);
    });
  }

  return filtered;
};

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
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

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

  // Resolving each requested Location/Practitioner's timezone only populates the module-scope
  // `timezoneMap` that makeAppointmentInformation reads when formatting appointment start times —
  // the appointment search itself uses the caller-supplied timezone. So these lookups must not gate
  // the search. Started here and awaited just before the results are formatted, they cost a round
  // trip on a cold invocation only, and that round trip now overlaps the appointment search instead
  // of preceding it. (On a warm invocation the map is already populated and nothing is fetched.)
  const timezonesResolved = Promise.all(
    requestedTimezoneRelatedResources.map((resource) =>
      getTimezone({ oystehr, resourceType: resource.resourceType, resourceId: resource.resourceId })
    )
  );

  const { appointmentResources, appointmentsToGroupMap } = await (async () => {
    // request appointments
    const resourceResults = await Promise.all(
      requestedTimezoneRelatedResources.map(async (options) => {
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

        let appointmentBundle;
        try {
          appointmentBundle = await oystehr.fhir.searchAndGetAllPages<AppointmentRelatedResources>(appointmentRequest);
        } catch (error) {
          if (isResponseSizeExceededError(error)) {
            throw APPOINTMENT_SEARCH_TOO_BROAD_ERROR;
          }
          throw error;
        }

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
    const response: GetAppointmentsZambdaOutput = {
      message: 'Successfully retrieved all appointments',
      preBooked,
      inOffice,
      completed,
      cancelled,
      ...emptyTrackingBoardExtras(),
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
    } else if (resource.resourceType === 'Encounter' && !isAnnotationFollowupEncounter(resource)) {
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

  // The queues only need the appointment and its encounter, so they are built here, ahead of the related-resource
  // searches, and reused when the response is assembled below.
  const appointments = filterAppointmentsForBoard(allAppointments, visitType, serviceCategories);
  const appointmentQueues = appointments.length > 0 ? sortAppointments(appointments, apptRefToEncounterMap) : undefined;

  // Tracking board Step B: order icons and vitals badges are keyed on the encounters in these queues, so their
  // batch goes out now and overlaps the related-resource searches instead of waiting behind them.
  const trackingBoardEncounterIds = appointmentQueues
    ? selectTrackingBoardEncounterIds(appointmentQueues, apptRefToEncounterMap)
    : [];
  const patientsByEncounterId = selectVitalsPatientsByEncounterId({
    appointments,
    apptRefToEncounterMap,
    patientIdMap,
  });
  const vitalsAlertConfigPromise = trackingBoardEncounterIds.length > 0 ? getVitalsEngineConfig(oystehr) : undefined;
  const trackingBoardResourcesPromise: Promise<TrackingBoardResources> = fetchTrackingBoardResources({
    oystehr,
    encounterIds: trackingBoardEncounterIds,
    // Optional: it only shortens `next` links, and a missing secret must not fail the page (see the catch below).
    fhirApiUrl: getOptionalSecret(SecretsKeys.FHIR_API, secrets),
  }).catch((error) => {
    // The board can render without its icons; log and fall back to empty maps rather than fail the page.
    console.error('tracking board orders/vitals fetch failed', error);
    captureException(error);
    return { resources: [], failedUrls: ['*'] };
  });

  console.time('related_resources');

  const patientIdsForSearch = patientIds.join(',');

  const relatedPersonFallbackPromise =
    patientIds.length > 0
      ? oystehr.fhir.search<RelatedPerson>({
          resourceType: 'RelatedPerson',
          params: [
            { name: 'patient', value: patientIdsForSearch },
            { name: 'relationship', value: 'user-relatedperson' },
          ],
        })
      : Promise.resolve(undefined);

  const docRefPromise =
    patientIds.length > 0
      ? oystehr?.fhir.search<DocumentReference>({
          resourceType: 'DocumentReference',
          params: [
            { name: 'status', value: 'current' },
            { name: 'type', value: `${INSURANCE_CARD_CODE},${PHOTO_ID_CARD_CODE}` },
            { name: 'related', value: patientIdsForSearch },
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

  const provenancePromises = chunkThings(encounterIds, PROVENANCE_SEARCH_CHUNK_SIZE).map((encounterIdChunk) =>
    oystehr.fhir.search<Provenance>({
      resourceType: 'Provenance',
      params: [
        { name: 'target', value: encounterIdChunk.map((encId) => `Encounter/${encId}`).join(',') },
        { name: 'agent-role', value: 'verifier' },
        { name: '_count', value: `${PROVENANCE_SEARCH_CHUNK_SIZE}` },
      ],
    })
  );

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

  const parentEncountersPromise =
    missingParentEncounterRefs.length > 0
      ? oystehr.fhir.search<Encounter>({
          resourceType: 'Encounter',
          params: [
            { name: '_id', value: missingParentEncounterRefs.map((ref) => ref.replace('Encounter/', '')).join(',') },
          ],
        })
      : Promise.resolve(undefined);

  const searchCommunications = (phoneNumbers: string[]): Promise<Bundle<Communication | RelatedPerson> | undefined> =>
    phoneNumbers.length > 0
      ? oystehr.fhir.search<Communication | RelatedPerson>({
          resourceType: 'Communication',
          params: [
            { name: 'medium', value: `${ZAP_SMS_MEDIUM_CODE}` },
            { name: 'sender:RelatedPerson.telecom', value: phoneNumbers.join(',') },
            { name: '_include', value: 'Communication:sender' },
          ],
        })
      : Promise.resolve(undefined);

  // Snapshot the numbers the main search already gave us; the speculative Communication search uses
  // exactly these, so the fallback's contribution can be diffed against it below.
  const phonesBeforeFallback = new Set(rpPhoneNumbers);
  const communicationsPromise = searchCommunications(Array.from(phonesBeforeFallback));

  const [
    relatedPersonFallbackBundle,
    docRefBundle,
    participantsBundle,
    parentEncountersBundle,
    speculativeCommunicationBundle,
    ...encounterSignaturesBundle
  ] = await Promise.all([
    relatedPersonFallbackPromise,
    docRefPromise,
    participantsPromise,
    parentEncountersPromise,
    communicationsPromise,
    ...provenancePromises,
  ]);

  const registerRelatedPerson = (rp: RelatedPerson): void => {
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
  };

  relatedPersonFallbackBundle?.unbundle().forEach(registerRelatedPerson);

  // Only the numbers the fallback added need a follow-up search; normally there are none and this
  // resolves without a round trip.
  const phonesMissedBySpeculativeSearch = Array.from(rpPhoneNumbers).filter(
    (phone) => !phonesBeforeFallback.has(phone)
  );
  const supplementalCommunicationBundle = await searchCommunications(phonesMissedBySpeculativeSearch);

  const allDocRefs: DocumentReference[] = docRefBundle?.unbundle() ?? [];
  const communications: (Communication | RelatedPerson)[] | undefined =
    speculativeCommunicationBundle || supplementalCommunicationBundle
      ? mergeResources([
          ...(speculativeCommunicationBundle?.unbundle() ?? []),
          ...(supplementalCommunicationBundle?.unbundle() ?? []),
        ])
      : undefined;

  const practitioners = participantsBundle?.unbundle() as Practitioner[];
  practitioners?.forEach((pr) => {
    practitionerIdToResourceMap[`Practitioner/${pr.id}`] = pr;
  });

  const encounterSignatures: Provenance[] = encounterSignaturesBundle.flatMap((bundle) => bundle?.unbundle() ?? []);

  const parentEncounterToApptIdMap: Record<string, string> = {};
  (parentEncountersBundle?.unbundle() ?? []).forEach((enc) => {
    const apptRef = enc.appointment?.[0]?.reference;
    if (enc.id && apptRef) {
      parentEncounterToApptIdMap[`Encounter/${enc.id}`] = apptRef.replace('Appointment/', '');
    }
  });

  console.timeEnd('related_resources');

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

  // makeAppointmentInformation reads timezoneMap, so the prefetch started before the appointment
  // search has to be settled by now.
  await timezonesResolved;

  console.time('structure_appointment_data');

  if (appointmentQueues) {
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

  // Step C: the batch has had the whole related-resource round trip to land; mapping is local work.
  let trackingBoardExtras = emptyTrackingBoardExtras();
  try {
    trackingBoardExtras = buildTrackingBoardExtras({
      fetched: await trackingBoardResourcesPromise,
      encounterIds: trackingBoardEncounterIds,
      encounters: Object.values(apptRefToEncounterMap),
      appointments,
      practitioners: Object.values(practitionerIdToResourceMap),
      patientsByEncounterId,
      vitalsAlertConfig: await vitalsAlertConfigPromise,
      environment: getSecret(SecretsKeys.ENVIRONMENT, secrets),
    });
  } catch (error) {
    console.error('tracking board orders/vitals mapping failed', error);
    captureException(error);
    trackingBoardExtras = { ...emptyTrackingBoardExtras(), ordersAndVitalsIncomplete: true };
  }

  const response: GetAppointmentsZambdaOutput = {
    message: 'Successfully retrieved all appointments',
    preBooked,
    inOffice,
    completed,
    cancelled,
    ...trackingBoardExtras,
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
