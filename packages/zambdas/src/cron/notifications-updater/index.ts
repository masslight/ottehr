import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Coding,
  Communication,
  Encounter,
  Location,
  Patient,
  Practitioner,
  Resource,
  Task,
} from 'fhir/r4b';
import { DateTime, Duration } from 'luxon';
import {
  AppointmentProviderNotificationTags,
  AppointmentProviderNotificationTypes,
  CATEGORY_NOTIFICATION_TAG_CODE,
  CATEGORY_NOTIFICATION_TAG_SYSTEM,
  checkEncounterHasPractitioner,
  ERX_TASK,
  getAllFhirSearchPages,
  getFullestAvailableName,
  getInPersonVisitStatus,
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  getProviderNotificationPreferencesV2,
  getProviderNotificationSettingsForPractitioner,
  getUiTaskCategoryForCode,
  getVideoRoomResourceExtension,
  hasExplicitProviderNotificationPreferencesV2,
  notificationRowMatchesLocation,
  NotificationRowPref,
  OTTEHR_MODULE,
  OttehrTaskSystem,
  PROVIDER_NOTIFICATION_CATEGORY_SYSTEM,
  PROVIDER_NOTIFICATION_TAG_SYSTEM,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  ProviderNotificationMethod,
  ProviderNotificationPreferencesV2,
  ProviderNotificationSettings,
  removePrefix,
  RoleType,
  Secrets,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
  UI_TASK_CATEGORY_LABELS,
  USER_TIMEZONE_EXTENSION_URL,
  VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
  VIRTUAL_VISIT_SCHEDULED_TAG_CODE,
  VIRTUAL_VISIT_SCHEDULED_TAG_SYSTEM,
  VisitStatusLabel,
  WAITING_ROOM_NOTIFIED_TAG_CODE,
  WAITING_ROOM_NOTIFIED_TAG_SYSTEM,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getEmployees,
  getRoleMembers,
  getRoles,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getTaskLocation } from '../../shared/tasks';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null } {
  return {
    secrets: input.secrets,
  };
}

// 'arrived' for OTR-2552
export const READY_OR_UNSIGNED_ENCOUNTER_STATUSES: Encounter['status'][] = ['planned', 'arrived', 'finished'];

export function resolveTaskRecipients(
  task: Task,
  owner: Practitioner | undefined,
  activeProviders: Practitioner[]
): Practitioner[] {
  if (owner) return [owner];
  const taskCode = task.code?.coding?.find((c) => c.system === OttehrTaskSystem)?.code;
  if (taskCode === VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE) return activeProviders;
  return [];
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('notification-Updater', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const sendSMSPractitionerCommunications: {
    [key: string]: {
      practitioner: Practitioner;
      communications: { communication: Communication; method: ProviderNotificationMethod | undefined }[];
    };
  } = {};

  const createCommunicationRequests: BatchInputPostRequest<Communication>[] = [];
  const updateCommunicationRequests: BatchInputRequest<Communication>[] = [];
  const updateAppointmentRequests: BatchInputRequest<Appointment>[] = [];

  // The delivery method is per-notification-row, so callers pass the resolved method.
  function addNewSMSCommunicationForPractitioner(
    practitioner: Practitioner,
    communication: Communication,
    status: Communication['status'],
    method: ProviderNotificationMethod | undefined
  ): void {
    if (
      status === 'completed' ||
      (status === 'in-progress' && method === ProviderNotificationMethod['phone and computer'])
    ) {
      addOrUpdateSMSPractitionerCommunications(communication, practitioner, method);
    }
  }

  function addOrUpdateSMSPractitionerCommunications(
    newCommunication: Communication,
    practitioner: Practitioner,
    method: ProviderNotificationMethod | undefined
  ): void {
    const existing = sendSMSPractitionerCommunications[practitioner.id!]?.communications ?? [];
    sendSMSPractitionerCommunications[practitioner.id!] = {
      practitioner: practitioner,
      communications: [...existing, { communication: newCommunication, method }],
    };
  }

  console.group('validateRequestParameters');
  const { secrets } = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  console.log('Created zapToken and fhir client');

  // Generous 1h lookback; the per-resource idempotency tags — not the window — gate "already notified?".
  const notificationWindowStart = DateTime.utc().minus({ hours: 1 });

  const [readyOrUnsignedVisitPackages, { activeStaffMap, activeProvidersMap }, recentTaskResources] = await Promise.all(
    [
      getResourcePackagesAppointmentsMap(
        oystehr,
        READY_OR_UNSIGNED_ENCOUNTER_STATUSES,
        // getting ready and unsigned appointments for the last 49 hours just to send appropriate notifications
        // on unsigned appointments that are in the unsigned state for too long
        DateTime.utc().minus(Duration.fromISO('PT49H')),
        // 'booked' for telemed appointment notifications, 'arrived' for waiting room notifications
        ['booked', 'arrived']
      ),
      getActiveStaffAndProviders(oystehr),
      getRecentTaskResources(oystehr, notificationWindowStart),
    ]
  );
  const recentlyCreatedTasks = recentTaskResources.filter((res): res is Task => res.resourceType === 'Task');
  const recentlyAssignedTasksMap = buildRecentlyAssignedTasksMap(recentTaskResources, notificationWindowStart);
  // these logs produce far too much detail so reducing them to counts
  console.log('--- Ready or unsigned visits count: ' + Object.keys(readyOrUnsignedVisitPackages).length);
  console.log('--- Active providers count: ' + Object.keys(activeProvidersMap).length);
  console.log('--- Recently assigned task ids: ' + Object.keys(recentlyAssignedTasksMap).join(', '));
  console.log('--- Active staff count: ' + Object.keys(activeStaffMap).length);
  console.log('--- Recently created tasks count: ' + recentlyCreatedTasks.length);

  // Parse each practitioner's V2 preferences (a JSON.parse of an extension blob) at most once per run.
  const prefsCache = new Map<string, ProviderNotificationPreferencesV2 | undefined>();
  const getPrefsCached = (practitioner: Practitioner): ProviderNotificationPreferencesV2 | undefined => {
    const id = practitioner.id;
    if (!id) return getProviderNotificationPreferencesV2(practitioner);
    if (!prefsCache.has(id)) prefsCache.set(id, getProviderNotificationPreferencesV2(practitioner));
    return prefsCache.get(id);
  };

  // Only staff with an EXPLICITLY saved V2 blob join the category engine — otherwise every un-migrated
  // staffer would be mass-notified about every new task.
  const staffWithPreferences: { practitioner: Practitioner; prefs: ProviderNotificationPreferencesV2 }[] =
    Object.values(activeStaffMap)
      .filter((practitioner) => hasExplicitProviderNotificationPreferencesV2(practitioner))
      .map((practitioner) => {
        const prefs = getPrefsCached(practitioner);
        return prefs ? { practitioner, prefs } : undefined;
      })
      .filter((entry): entry is { practitioner: Practitioner; prefs: ProviderNotificationPreferencesV2 } => !!entry);

  // Going through ready or unsigned visits to create notifications and other update logic
  Object.keys(readyOrUnsignedVisitPackages).forEach((appointmentId) => {
    try {
      const { appointment, encounter, location, communications, patient } = readyOrUnsignedVisitPackages[appointmentId];
      if (encounter && appointment) {
        const status: VisitStatusLabel | undefined = getInPersonVisitStatus(appointment, encounter);
        if (!status) return;

        // Backwards-compat during deploy: upgrade any 'preparation' Communications created by the
        // prior busy-suppression logic. Safe to remove after one full cron window.
        if (communications?.length) {
          const postponedCommunications = communications.filter(
            (comm) => comm.status === 'preparation' && comm.recipient?.[0].reference
          );
          postponedCommunications.forEach((communication) => {
            const communicationPractitionerId = communication.recipient![0].reference!.split('/')[1];
            const practitioner = activeProvidersMap[communicationPractitionerId];
            const notificationSettings = getProviderNotificationSettingsForPractitioner(practitioner);
            if (notificationSettings && notificationSettings.telemedNotificationsEnabled) {
              const newStatus = getCommunicationStatus(notificationSettings);
              updateCommunicationRequests.push(
                getPatchBinary({
                  resourceId: communication.id!,
                  resourceType: 'Communication',
                  patchOperations: [
                    {
                      op: 'replace',
                      path: '/status',
                      value: newStatus,
                    },
                  ],
                })
              );
              addNewSMSCommunicationForPractitioner(
                practitioner,
                communication,
                newStatus,
                notificationSettings.method
              );
            }
          });
        }

        const patientName = patient ? getFullestAvailableName(patient) : 'patient';
        const appointmentTimeForProvider = (provider: Practitioner): string | undefined => {
          if (!appointment.start) return undefined;
          const providerTimezone = provider.extension?.find(
            (ext) => ext.url === USER_TIMEZONE_EXTENSION_URL
          )?.valueString;
          return DateTime.fromISO(appointment.start)
            .setZone(
              Intl.supportedValuesOf('timeZone').includes(providerTimezone || '')
                ? providerTimezone
                : 'America/New_York'
            )
            .toFormat('h:mm a');
        };

        // Notify every provider whose V2 row matches this appointment. Idempotent via an appointment
        // meta.tag; each row uses its own tag system so the two markers never clobber each other.
        const emitTelemedNotification = (
          rowSelector: (prefs: ProviderNotificationPreferencesV2) => NotificationRowPref,
          notificationType: AppointmentProviderNotificationTypes,
          tag: { system: string; code: string },
          buildMessage: (provider: Practitioner) => string,
          opts?: TelemedNotificationGateOptions
        ): void => {
          if (!shouldEmitTelemedNotification(appointment, location, tag, opts)) return;

          updateAppointmentRequests.push(
            getPatchBinary({
              resourceId: appointment.id!,
              resourceType: 'Appointment',
              patchOperations: [getPatchOperationForNewMetaTag(appointment, tag)],
            })
          );

          const locationId = location?.id;
          for (const provider of Object.values(activeProvidersMap)) {
            const prefs = getPrefsCached(provider);
            if (!prefs) continue;
            const row = rowSelector(prefs);
            const isAssignedToMe = checkEncounterHasPractitioner(encounter, provider);
            if (!rowMatchesFilters(row, locationId, isAssignedToMe)) continue;

            const status = communicationStatusForMethod(row.method);
            const request: BatchInputPostRequest<Communication> = {
              method: 'POST',
              url: '/Communication',
              resource: {
                resourceType: 'Communication',
                category: [{ coding: [{ system: PROVIDER_NOTIFICATION_TYPE_SYSTEM, code: notificationType }] }],
                sent: DateTime.utc().toISO()!,
                status: status,
                encounter: { reference: `Encounter/${encounter.id}` },
                recipient: [{ reference: `Practitioner/${provider.id}` }],
                payload: [{ contentString: buildMessage(provider) }],
              },
            };
            createCommunicationRequests.push(request);
            addNewSMSCommunicationForPractitioner(provider, request.resource as Communication, status, row.method);
          }
        };

        if (status === 'pending') {
          // 'pending' == appointment.status 'booked' == the patient has scheduled a virtual visit
          emitTelemedNotification(
            (prefs) => prefs.virtualVisitScheduled,
            AppointmentProviderNotificationTypes.virtual_visit_scheduled,
            { system: VIRTUAL_VISIT_SCHEDULED_TAG_SYSTEM, code: VIRTUAL_VISIT_SCHEDULED_TAG_CODE },
            (provider) => {
              const appointmentTime = appointmentTimeForProvider(provider);
              return appointmentTime
                ? `Virtual visit with ${patientName} at ${appointmentTime}`
                : 'Virtual visit with patient soon';
            },
            {
              // Deploy transition: the old cron stamped this legacy tag when it sent its booking-time
              // notification — treat it as "already notified" so in-flight appointments aren't re-notified.
              alsoSkipIfTagged: [
                { system: PROVIDER_NOTIFICATION_TAG_SYSTEM, code: AppointmentProviderNotificationTags.patient_waiting },
              ],
            }
          );
        } else if (status === 'arrived') {
          // 'arrived' == the patient has checked in and is ready in the virtual waiting room.
          // No location-state requirement here (the old check-in path had none) — a misconfigured
          // Location must not silently swallow "your patient is waiting".
          emitTelemedNotification(
            (prefs) => prefs.waitingRoom,
            AppointmentProviderNotificationTypes.patient_waiting,
            { system: WAITING_ROOM_NOTIFIED_TAG_SYSTEM, code: WAITING_ROOM_NOTIFIED_TAG_CODE },
            () => `${patientName} is ready in the virtual waiting room`,
            { requireLocationState: false }
          );
        }
      }
    } catch (error) {
      console.error(`Error trying to process notifications for appointment ${appointmentId}`, error);
      captureException(error);
    }
  });

  const updateTaskRequests: BatchInputRequest<Task>[] = [];
  const telemedRelatedTaskCodes = [VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE];

  // Both engines can tag the same task; accumulate tags per task and flush as ONE patch per task — two
  // patch entries for one resource in a single transaction can clobber each other or be rejected.
  const taskMetaTagsById = new Map<string, { task: Task; tags: Coding[] }>();
  const queueTaskMetaTag = (task: Task, tag: Coding): void => {
    const entry = taskMetaTagsById.get(task.id!);
    if (!entry) {
      taskMetaTagsById.set(task.id!, { task, tags: [tag] });
    } else if (!entry.tags.some((t) => t.system === tag.system && t.code === tag.code)) {
      entry.tags.push(tag);
    }
  };

  // The category engine runs FIRST and records exactly which (task, practitioner) pairs it notified; the
  // assignment engine defers only for those pairs, instead of re-deriving (and drifting from) this rule.
  const categoryNotifiedThisRun = new Set<string>();

  // Notify category subscribers about ANY newly-created task in that category, not just tasks
  // assigned to them.
  recentlyCreatedTasks.forEach((task) => {
    try {
      // idempotency: dedicated tag system so it never clobbers the legacy 'task_assigned' marker
      if (hasCategoryNotifiedTag(task)) return;

      // telemed / waiting-room tasks are handled exclusively by the telemed appointment path above
      const taskCodes = task.code?.coding;
      const ottehrTaskCode = taskCodes?.find((coding) => coding.system === OttehrTaskSystem)?.code;
      if (ottehrTaskCode && telemedRelatedTaskCodes.includes(ottehrTaskCode)) return;

      const uiCategory = getUiTaskCategoryForCode(task.groupIdentifier?.value);
      if (!uiCategory) return; // uncategorized tasks can't be matched to a subscription

      const taskLocationId = getTaskLocation(task)?.id;

      // mark processed once we recognize the category, even if nobody is subscribed (avoids rescanning every run)
      queueTaskMetaTag(task, { system: CATEGORY_NOTIFICATION_TAG_SYSTEM, code: CATEGORY_NOTIFICATION_TAG_CODE });

      // The _lastUpdated window also re-surfaces old, untagged tasks on their first edit — tag them above,
      // but only genuinely new tasks may fire a "New <Category> task" notification.
      if (!isTaskNewlyCreated(task, notificationWindowStart)) return;

      for (const { practitioner, prefs } of staffWithPreferences) {
        const row = prefs.taskCategories[uiCategory];
        // Only 'anyone' subscriptions fire at creation; 'me' rows (and any assignment case this loop
        // doesn't reach) are delivered by the assignment engine below.
        if (row.assignedTo !== 'anyone') continue;
        if (!rowMatchesFilters(row, taskLocationId, false)) continue;

        const status = communicationStatusForMethod(row.method);
        const message = `New ${UI_TASK_CATEGORY_LABELS[uiCategory]} task: ${task.description ?? `task ID ${task.id}`}`;
        const request: BatchInputPostRequest<Communication> = {
          method: 'POST',
          url: '/Communication',
          resource: {
            resourceType: 'Communication',
            category: [
              {
                coding: [
                  {
                    system: PROVIDER_NOTIFICATION_TYPE_SYSTEM,
                    code: AppointmentProviderNotificationTypes.task_category_created,
                  },
                  {
                    system: PROVIDER_NOTIFICATION_CATEGORY_SYSTEM,
                    code: uiCategory,
                    display: UI_TASK_CATEGORY_LABELS[uiCategory],
                  },
                ],
              },
            ],
            sent: DateTime.utc().toISO()!,
            status: status,
            basedOn: [{ reference: `Task/${task.id}` }],
            recipient: [{ reference: `Practitioner/${practitioner.id}` }],
            payload: [{ contentString: message }],
          },
        };
        createCommunicationRequests.push(request);
        addNewSMSCommunicationForPractitioner(practitioner, request.resource as Communication, status, row.method);
        categoryNotifiedThisRun.add(categoryNotifiedKey(task.id!, practitioner.id!));
      }
    } catch (error) {
      console.error(`Error trying to process category notification for task ${task.id}`, error);
      captureException(error);
    }
  });

  // Process recently assigned tasks to create task assignment notifications
  Object.keys(recentlyAssignedTasksMap).forEach((taskId) => {
    try {
      const { task, practitioner } = recentlyAssignedTasksMap[taskId];

      const taskCodes = task.code?.coding;
      const ottehrTaskCode = taskCodes?.find((coding) => coding.system === OttehrTaskSystem)?.code;
      const erxTaskCode = taskCodes?.find((coding) => coding.system === ERX_TASK.system)?.code;
      const taskCode = ottehrTaskCode || erxTaskCode || '';

      // Check-ins are emitted by the appointment 'arrived' path; suppress the legacy waiting-room task
      // fan-out so a single check-in isn't double-notified.
      if (taskCode === VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE) return;

      const isProcessed = task.meta?.tag?.find(
        (tag) =>
          tag.system === PROVIDER_NOTIFICATION_TAG_SYSTEM &&
          tag.code === AppointmentProviderNotificationTypes.task_assigned
      );
      if (isProcessed) return;

      const recipients = resolveTaskRecipients(task, practitioner, Object.values(activeProvidersMap));
      if (recipients.length === 0) return;

      queueTaskMetaTag(task, {
        system: PROVIDER_NOTIFICATION_TAG_SYSTEM,
        code: AppointmentProviderNotificationTypes.task_assigned,
      });

      for (const recipient of recipients) {
        const delivery = resolveAssignmentDelivery({
          task,
          recipient,
          hasExplicitPrefs: hasExplicitProviderNotificationPreferencesV2(recipient),
          prefs: getPrefsCached(recipient),
          legacySettings: getProviderNotificationSettingsForPractitioner(recipient),
          categoryNotifiedThisRun,
          taskLocationId: getTaskLocation(task)?.id,
        });
        if (!delivery.notify) continue;
        const method = delivery.method;

        const status = communicationStatusForMethod(method);
        const title = 'A new task has been assigned to you: ' + (task.description ?? `task ID ${task.id}`);

        const request: BatchInputPostRequest<Communication> = {
          method: 'POST',
          url: '/Communication',
          resource: {
            resourceType: 'Communication',
            category: [
              {
                coding: [
                  {
                    system: PROVIDER_NOTIFICATION_TYPE_SYSTEM,
                    code: AppointmentProviderNotificationTypes.task_assigned,
                  },
                ],
              },
            ],
            sent: DateTime.utc().toISO()!,
            status: status,
            basedOn: [{ reference: `Task/${task.id}` }],
            recipient: [{ reference: `Practitioner/${recipient.id}` }],
            payload: [{ contentString: title }],
          },
        };

        createCommunicationRequests.push(request);
        addNewSMSCommunicationForPractitioner(recipient, request.resource as Communication, status, method);
      }
    } catch (error) {
      console.error(`Error trying to process task assignment notification for task ${taskId}`, error);
      captureException(error);
    }
  });

  // Flush accumulated tags as one patch per task, computing per-tag APPEND ops against a working copy.
  // Not getPatchOperationsForNewMetaTags: its wholesale /meta/tag replace would clobber tags a concurrent
  // writer added after our read.
  for (const { task, tags } of taskMetaTagsById.values()) {
    const working: Task = {
      ...task,
      meta: task.meta ? { ...task.meta, tag: task.meta.tag ? [...task.meta.tag] : undefined } : undefined,
    };
    const patchOperations = tags.map((tag) => {
      const op = getPatchOperationForNewMetaTag(working, tag);
      working.meta = { ...(working.meta ?? {}), tag: [...(working.meta?.tag ?? []), tag] };
      return op;
    });
    updateTaskRequests.push(getPatchBinary({ resourceId: task.id!, resourceType: 'Task', patchOperations }));
  }

  // SMS is sent only AFTER the FHIR transaction commits: if the idempotency tags aren't stamped, no SMS
  // goes out, so the next run can retry without double-texting.
  const smsToSend: { practitionerRef: string; message: string }[] = [];
  Object.keys(sendSMSPractitionerCommunications).forEach((id) => {
    try {
      const { practitioner, communications } = sendSMSPractitionerCommunications[id];
      const hasSmsTelecom = practitioner.telecom?.find((tel) => tel.system === 'sms' && Boolean(tel.value));
      if (!hasSmsTelecom) return;
      communications.forEach(({ communication, method }) => {
        const smsEligible =
          method === ProviderNotificationMethod.phone || method === ProviderNotificationMethod['phone and computer'];
        if (smsEligible && communication.payload?.[0].contentString) {
          smsToSend.push({
            practitionerRef: `Practitioner/${practitioner.id!}`,
            message: communication.payload[0].contentString,
          });
        }
      });
    } catch (error) {
      console.error(
        `Error trying to prepare SMS notifications for practitioner ${sendSMSPractitionerCommunications[id].practitioner.id}`,
        error
      );
      captureException(error);
    }
  });

  console.log(`Update appointment requests: ${JSON.stringify(updateAppointmentRequests)}`);
  console.log(`Create communications requests: ${JSON.stringify(createCommunicationRequests)}`);

  if (
    updateAppointmentRequests.length > 0 ||
    createCommunicationRequests.length > 0 ||
    updateCommunicationRequests.length > 0 ||
    updateTaskRequests.length > 0
  ) {
    await oystehr.fhir.transaction<Appointment | Communication | Task>({
      requests: [
        ...updateAppointmentRequests,
        ...createCommunicationRequests,
        ...updateCommunicationRequests,
        ...updateTaskRequests,
      ],
    });
  }

  if (smsToSend.length > 0) {
    const smsResults = await Promise.allSettled(
      smsToSend.map(({ practitionerRef, message }) =>
        oystehr.transactionalSMS.send({ resource: practitionerRef, message })
      )
    );
    smsResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error sending SMS notification to ${smsToSend[index].practitionerRef}`, result.reason);
        captureException(result.reason);
      }
    });
  }

  return {
    statusCode: 200,
    body: 'Successfully processed provider notifications',
  };
});

interface ResourcePackage {
  appointment?: Appointment;
  encounter?: Encounter;
  communications: Communication[];
  location?: Location;
  patient?: Patient;
}

type ResourcePackagesMap = { [key: NonNullable<Appointment['id']>]: ResourcePackage };

/** Getting appointments with chosen status (default "arrived") and encounter with statuses that
 * correspond to Telemed statuses "ready", "pre-video", "on-video", "unsigned". Include related
 * encounter, patient, provider and communication
 */
async function getResourcePackagesAppointmentsMap(
  oystehr: Oystehr,
  statuses: Encounter['status'][],
  fromDate: DateTime,
  appointmentStatuses: Appointment['status'][] = ['arrived']
): Promise<ResourcePackagesMap> {
  const results = (
    await oystehr.fhir.search<Appointment | Communication | Encounter | Location | Patient>({
      resourceType: 'Appointment',
      params: [
        { name: '_tag', value: OTTEHR_MODULE.TM },
        {
          name: 'date',
          value: `ge${fromDate}`,
        },
        {
          name: 'status',
          value: appointmentStatuses.join(','),
        },
        {
          name: '_revinclude',
          value: 'Encounter:appointment',
        },
        {
          name: '_include',
          value: 'Appointment:location',
        },
        {
          name: '_include',
          value: 'Appointment:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Communication:encounter',
        },
        {
          name: '_has:Encounter:appointment:status',
          value: statuses.join(','),
        },
      ],
    })
  ).unbundle();

  const getOrCreateAppointmentResourcePackage = (appointmentId: string): (typeof resourcePackagesMap)[string] => {
    if (!resourcePackagesMap[appointmentId]) {
      resourcePackagesMap[appointmentId] = {
        communications: [],
      };
    }
    return { ...resourcePackagesMap[appointmentId] };
  };

  const encounterIdAppointmentIdMap: { [key: NonNullable<Encounter['id']>]: NonNullable<Appointment['id']> } = {};
  const resourcePackagesMap: ResourcePackagesMap = {};
  const locationIdMap: { [key: NonNullable<Location['id']>]: Location } = {};
  const patientIdMap: { [key: NonNullable<Patient['id']>]: Patient } = {};
  // first fill maps with Appointments and Encounters
  results.forEach((res) => {
    if (res.resourceType === 'Encounter') {
      const encounter = res as Encounter;
      const appointmentId = getTelemedEncounterAppointmentId(encounter);
      if (appointmentId) {
        const pack = getOrCreateAppointmentResourcePackage(appointmentId);
        pack.encounter = encounter;
        resourcePackagesMap[appointmentId] = pack;
        encounterIdAppointmentIdMap[encounter.id!] = appointmentId;
      }
    } else if (res.resourceType === 'Appointment') {
      const appointment = res as Appointment;
      const pack = getOrCreateAppointmentResourcePackage(appointment.id!);
      pack.appointment = appointment;
      resourcePackagesMap[appointment.id!] = pack;
    } else if (res.resourceType === 'Location') {
      // create locations id map for later optimized mapping
      const location = res as Location;
      locationIdMap[location.id!] = location;
    } else if (res.resourceType === 'Patient') {
      // create patients id map for later optimized mapping
      const patient = res as Patient;
      patientIdMap[patient.id!] = patient;
    }
  });

  results.forEach((res) => {
    // fill in communications (it needs already some filled in maps)
    if (res.resourceType === 'Communication') {
      const communication = res as Communication;
      const encounterReference = communication.encounter!.reference!;
      const encounterId = removePrefix('Encounter/', encounterReference)!;
      const appointmentId = encounterIdAppointmentIdMap[encounterId];
      const pack = getOrCreateAppointmentResourcePackage(appointmentId);
      pack.communications.push(communication);
      resourcePackagesMap[appointmentId] = pack;
    }
  });

  // fill in locations and patients
  Object.keys(resourcePackagesMap).forEach((appointmentId) => {
    const encounter = resourcePackagesMap[appointmentId].encounter;
    const appointment = resourcePackagesMap[appointmentId].appointment;
    const locationReference = encounter?.location?.find((loc) => loc.location.reference)?.location.reference;
    if (locationReference) {
      const locationId = removePrefix('Location/', locationReference);
      if (locationId) {
        const pack = getOrCreateAppointmentResourcePackage(appointmentId);
        pack.location = locationIdMap[locationId];
        resourcePackagesMap[appointmentId] = pack;
      }
    }
    const patientReference = appointment?.participant?.find((participant) =>
      participant.actor?.reference?.startsWith('Patient')
    )?.actor?.reference;
    if (patientReference) {
      const patientId = removePrefix('Patient/', patientReference);
      if (patientId) {
        const pack = getOrCreateAppointmentResourcePackage(appointmentId);
        pack.patient = patientIdMap[patientId];
        resourcePackagesMap[appointmentId] = pack;
      }
    }
  });

  return resourcePackagesMap;
}

/**
 * One fetch for both audiences: `activeStaffMap` is all active staff with a Practitioner profile
 * regardless of role (so category notifications reach Billing/Coding/etc. — the subscription, not the
 * role, is the access control); `activeProvidersMap` is the Provider-role subset the telemed paths use.
 */
const getActiveStaffAndProviders = async (
  oystehr: Oystehr
): Promise<{ activeStaffMap: ProvidersMap; activeProvidersMap: ProvidersMap }> => {
  const [employees, roles] = await Promise.all([getEmployees(oystehr), getRoles(oystehr)]);

  const inactiveRoleId = roles.find((role: any) => role.name === RoleType.Inactive)?.id;
  const providerRoleId = roles.find((role: any) => role.name === RoleType.Provider)?.id;
  if (!inactiveRoleId || !providerRoleId) {
    throw new Error('Error searching for Inactive or Provider role.');
  }

  const practitionerIds = employees.map((employee) => employee.profile.split('/')[1]);

  const [inactiveRoleMembers, providerRoleMembers, practitionerResources] = await Promise.all([
    getRoleMembers(inactiveRoleId, oystehr),
    getRoleMembers(providerRoleId, oystehr),
    // Paginate: one capped page would silently drop practitioners (and their subscriptions) in a large org.
    getAllFhirSearchPages<Practitioner>(
      {
        resourceType: 'Practitioner',
        params: [{ name: '_id', value: practitionerIds.join(',') }],
      },
      oystehr
    ),
  ]);

  console.log(
    `Fetched ${inactiveRoleMembers.length} Inactive and ${providerRoleMembers.length} Provider role members.`
  );

  const inactiveUsersMap = new Map(inactiveRoleMembers.map((user) => [user.id, user]));
  const providerUsersMap = new Map(providerRoleMembers.map((user) => [user.id, user]));
  const practitionerById = new Map(practitionerResources.map((res) => [res.id, res]));

  const activeStaffMap: ProvidersMap = {};
  const activeProvidersMap: ProvidersMap = {};
  employees.forEach((employee) => {
    if (inactiveUsersMap.has(employee.id)) return;
    const practitionerId = removePrefix('Practitioner/', employee.profile || '');
    const practitioner = practitionerId ? practitionerById.get(practitionerId) : undefined;
    if (!practitioner) return;
    activeStaffMap[practitioner.id!] = practitioner;
    if (providerUsersMap.has(employee.id)) {
      activeProvidersMap[practitioner.id!] = practitioner;
    }
  });
  return { activeStaffMap, activeProvidersMap };
};

/**
 * One paginated search (a capped page would silently drop tasks in a burst) feeding both engines: all
 * in-window tasks plus their owner Practitioners. Queries `_lastUpdated` (indexed) rather than
 * `authoredOn` — the meta.tags de-dup, and `isTaskNewlyCreated` filters merely-edited old tasks.
 */
export async function getRecentTaskResources(oystehr: Oystehr, fromDate: DateTime): Promise<(Task | Practitioner)[]> {
  return getAllFhirSearchPages<Task | Practitioner>(
    {
      resourceType: 'Task',
      params: [
        { name: 'status', value: 'requested,received,accepted,ready,in-progress' },
        { name: '_lastUpdated', value: `ge${fromDate.toISO()}` },
        { name: '_include', value: 'Task:owner' },
      ],
    },
    oystehr
  );
}

/** Whether the task was actually CREATED within the window, as opposed to merely edited inside it. */
export function isTaskNewlyCreated(task: Task, windowStart: DateTime): boolean {
  const authoredOn = task.authoredOn ? DateTime.fromISO(task.authoredOn) : null;
  return !!authoredOn && authoredOn >= windowStart;
}

/** Whether the category engine has already processed this task (in an earlier run). */
export function hasCategoryNotifiedTag(task: Task): boolean {
  return !!task.meta?.tag?.some(
    (tag) => tag.system === CATEGORY_NOTIFICATION_TAG_SYSTEM && tag.code === CATEGORY_NOTIFICATION_TAG_CODE
  );
}

type ProvidersMap = { [key: string]: Practitioner };

interface TaskWithPractitioner {
  task: Task;
  // unassigned telemed visits have no owner but need waiting room notifications
  practitioner?: Practitioner;
}

type RecentlyAssignedTasksMap = { [key: NonNullable<Task['id']>]: TaskWithPractitioner };

export function buildRecentlyAssignedTasksMap(
  bundle: (Task | Practitioner)[],
  fromDate: DateTime
): RecentlyAssignedTasksMap {
  const resultMap: RecentlyAssignedTasksMap = {};
  const practitionerIdMap: { [key: string]: Practitioner } = {};
  const tasks: Task[] = [];
  bundle.forEach((res) => {
    if (res.resourceType === 'Practitioner') {
      const practitioner = res as Practitioner;
      practitionerIdMap[practitioner.id!] = practitioner;
    } else if (res.resourceType === 'Task') {
      tasks.push(res as Task);
    }
  });
  tasks.forEach((task) => {
    if (task.owner?.reference) {
      const assignedDateTimeExt = task.owner.extension?.find(
        (ext) => ext.url === TASK_ASSIGNED_DATE_TIME_EXTENSION_URL
      );
      const assignedDateTime = assignedDateTimeExt?.valueDateTime
        ? DateTime.fromISO(assignedDateTimeExt.valueDateTime)
        : null;

      if (assignedDateTime && assignedDateTime >= fromDate) {
        const practitionerId = removePrefix('Practitioner/', task.owner.reference);
        if (practitionerId && practitionerIdMap[practitionerId]) {
          resultMap[task.id!] = {
            task,
            practitioner: practitionerIdMap[practitionerId],
          };
        }
      }
    } else {
      const taskCode = task.code?.coding?.find((c) => c.system === OttehrTaskSystem)?.code;
      if (taskCode !== VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE) return;
      const authoredOn = task.authoredOn ? DateTime.fromISO(task.authoredOn) : null;
      if (authoredOn && authoredOn >= fromDate) {
        resultMap[task.id!] = { task };
      }
    }
  });
  return resultMap;
}

export function getCommunicationStatus(notificationSettings: ProviderNotificationSettings): Communication['status'] {
  return communicationStatusForMethod(notificationSettings.method);
}

/** Phone-only → 'completed' (drives SMS-only); anything using the computer → 'in-progress' (lights the bell). */
export function communicationStatusForMethod(method: ProviderNotificationMethod | undefined): Communication['status'] {
  return method === ProviderNotificationMethod.phone ? 'completed' : 'in-progress';
}

/** Whether a per-row notification preference matches a task/appointment's location and assignment. */
export function rowMatchesFilters(
  row: NotificationRowPref,
  locationId: string | undefined,
  isAssignedToRecipient: boolean
): boolean {
  if (!row.enabled) return false;
  if (!notificationRowMatchesLocation(row, locationId)) return false;
  if (row.assignedTo === 'me' && !isAssignedToRecipient) return false;
  return true;
}

/** Key for the per-run "category engine already notified this person about this task" set. */
export const categoryNotifiedKey = (taskId: string, practitionerId: string): string => `${taskId}|${practitionerId}`;

export interface AssignmentDeliveryInput {
  task: Task;
  recipient: Practitioner;
  /** Whether the recipient has an explicitly saved V2 preferences blob (migrated staff). */
  hasExplicitPrefs: boolean;
  prefs: ProviderNotificationPreferencesV2 | undefined;
  legacySettings: ProviderNotificationSettings | undefined;
  /** `categoryNotifiedKey` pairs the category engine notified earlier in this same run. */
  categoryNotifiedThisRun: Set<string>;
  taskLocationId: string | undefined;
}

/**
 * Whether (and how) the assignment engine notifies a task's owner. Defers ONLY for pairs the category
 * engine actually recorded this run — anyone it skipped, for any reason (including an owner outside its
 * active-staff population), is still considered here.
 */
export function resolveAssignmentDelivery(
  input: AssignmentDeliveryInput
): { notify: false } | { notify: true; method: ProviderNotificationMethod | undefined } {
  const { task, recipient, hasExplicitPrefs, prefs, legacySettings, categoryNotifiedThisRun, taskLocationId } = input;

  if (task.owner && hasExplicitPrefs) {
    // Migrated staff route category task notifications through their V2 preferences.
    const uiCategory = getUiTaskCategoryForCode(task.groupIdentifier?.value);
    if (uiCategory) {
      const row = prefs?.taskCategories[uiCategory];
      if (!row) return { notify: false };
      // The category engine already told this person about this task this run — don't double-notify.
      if (categoryNotifiedThisRun.has(categoryNotifiedKey(task.id ?? '', recipient.id ?? ''))) {
        return { notify: false };
      }
      if (!rowMatchesFilters(row, taskLocationId, true)) return { notify: false };
      return { notify: true, method: row.method };
    }
    // Uncategorized task: no V2 row to consult, so the legacy flag decides.
    if (!legacySettings?.taskNotificationsEnabled) return { notify: false };
    return { notify: true, method: legacySettings.method };
  }

  // Non-migrated staff keep legacy behavior.
  if (!legacySettings?.taskNotificationsEnabled) return { notify: false };
  return { notify: true, method: legacySettings.method };
}

export interface TelemedNotificationGateOptions {
  /** Additional tags that mean "already notified" (e.g. the legacy booking marker from older deploys). */
  alsoSkipIfTagged?: { system: string; code: string }[];
  /** Default true; the waiting-room path passes false (see call site). */
  requireLocationState?: boolean;
}

/** Idempotency + data-sanity gate for the telemed appointment notifications (booking / waiting-room). */
export function shouldEmitTelemedNotification(
  appointment: Appointment,
  location: Location | undefined,
  tag: { system: string; code: string },
  opts?: TelemedNotificationGateOptions
): boolean {
  const hasTag = (t: { system: string; code: string }): boolean =>
    !!appointment.meta?.tag?.some((mt) => mt.system === t.system && mt.code === t.code);
  if (hasTag(tag) || opts?.alsoSkipIfTagged?.some(hasTag)) return false;
  if ((opts?.requireLocationState ?? true) && !location?.address?.state) return false;
  return true;
}

const getTelemedEncounterAppointmentId = (encounterResource: Resource): string | undefined => {
  if (!(encounterResource.resourceType === 'Encounter' && getVideoRoomResourceExtension(encounterResource)))
    return undefined;
  const appointmentReference = (encounterResource as Encounter)?.appointment?.[0].reference || '';
  const appointmentId = removePrefix('Appointment/', appointmentReference);

  return appointmentId;
};
