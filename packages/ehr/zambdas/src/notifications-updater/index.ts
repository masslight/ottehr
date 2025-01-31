import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Communication, Encounter, EncounterStatusHistory, Location, Practitioner } from 'fhir/r4b';
import { DateTime, Duration } from 'luxon';
import {
  AppointmentProviderNotificationTags,
  AppointmentProviderNotificationTypes,
  OTTEHR_MODULE,
  PROVIDER_NOTIFICATION_TAG_SYSTEM,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  ProviderNotificationMethod,
  ProviderNotificationSettings,
  RoleType,
  TelemedAppointmentStatus,
  TelemedAppointmentStatusEnum,
  allLicensesForPractitioner,
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  getProviderNotificationSettingsForPractitioner,
  mapStatusToTelemed,
} from 'utils';
import { Secrets } from 'zambda-utils';
import { getTelemedEncounterAppointmentId } from '../get-telemed-appointments/helpers/mappers';
import { getEmployees, getRoleMembers, getRoles } from '../shared';
import { removePrefix } from '../shared/appointment/helpers';
import { topLevelCatch } from '../shared/errors';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): { secrets: Secrets | null } {
  return {
    secrets: input.secrets,
  };
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const sendSMSPractitionerCommunications: {
    [key: string]: { practitioner: Practitioner; communications: Communication[] };
  } = {};
  const busyPractitionerIds: Set<string> = new Set();

  const createCommunicationRequests: BatchInputPostRequest<Communication>[] = [];
  const updateCommunicationRequests: BatchInputRequest<Communication>[] = [];
  const updateAppointmentRequests: BatchInputRequest<Appointment>[] = [];

  const practitionerUnsignedTooLongAppoitmentPackagesMap: {
    [key: string]: { pack: ResourcePackage; isProcessed: boolean }[];
  } = {};

  function addNewSMSCommunicationForPractitioner(
    practitioner: Practitioner,
    communication: Communication,
    status: Communication['status']
  ): void {
    const notificationSettings = getProviderNotificationSettingsForPractitioner(practitioner);
    if (
      notificationSettings &&
      (status === 'completed' ||
        (status === 'in-progress' && notificationSettings?.method === ProviderNotificationMethod['phone and computer']))
    ) {
      addOrUpdateSMSPractitionerCommunications(communication, practitioner);
    }
  }

  function addOrUpdateSMSPractitionerCommunications(newCommunication: Communication, practitioner: Practitioner): void {
    sendSMSPractitionerCommunications[practitioner.id!] = {
      practitioner: practitioner,
      communications: sendSMSPractitionerCommunications[practitioner.id!]?.communications
        ? [...sendSMSPractitionerCommunications[practitioner.id!].communications, newCommunication]
        : [newCommunication],
    };
  }

  try {
    console.group('validateRequestParameters');
    const { secrets } = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
    console.log('Created zapToken and fhir client');

    const [readyOrUnsignedVisitPackages, assignedOrInProgressVisitPackages, statePractitionerMap] = await Promise.all([
      getResourcePackagesAppointmentsMap(
        oystehr,
        ['planned', 'finished'],
        // getting ready and unsigned appointments for the last 49 hours just to send appropriate notifications
        // on unsigned appointments that are in the unsigned state for too long
        DateTime.utc().minus(Duration.fromISO('PT49H'))
      ),
      getResourcePackagesAppointmentsMap(
        oystehr,
        ['arrived', 'in-progress'],
        DateTime.utc().minus(Duration.fromISO('PT24H'))
      ),
      getPractitionersByStatesMap(oystehr),
    ]);
    console.log('--- Ready or unsigned: ' + JSON.stringify(readyOrUnsignedVisitPackages));
    console.log('--- In progress: ' + JSON.stringify(assignedOrInProgressVisitPackages));
    console.log('--- States/practitioners map: ' + JSON.stringify(statePractitionerMap));

    const allPractitionersIdMap = Object.keys(statePractitionerMap).reduce<{ [key: string]: Practitioner }>(
      (acc, val) => {
        const practitioners = statePractitionerMap[val].map((practitioner) => practitioner);
        practitioners.forEach((pract) => {
          acc[pract.id!] = pract;
        });
        return acc;
      },
      {}
    );

    // Going through arrived or in-progress visits to determine busy practitioners that should not receive a notification
    Object.keys(assignedOrInProgressVisitPackages).forEach((appointmentId) => {
      const { practitioner } = assignedOrInProgressVisitPackages[appointmentId];
      if (practitioner) {
        busyPractitionerIds.add(practitioner.id!);
      }
    });

    console.log(`Busy practitioners: ${JSON.stringify(busyPractitionerIds)}`);

    // Going through ready or unsigned visits to create notifications and other update logic
    Object.keys(readyOrUnsignedVisitPackages).forEach((appointmentId) => {
      try {
        const { appointment, encounter, practitioner, location, communications } =
          readyOrUnsignedVisitPackages[appointmentId];
        if (encounter && appointment) {
          const status: TelemedAppointmentStatus | undefined = mapStatusToTelemed(encounter.status, appointment.status);
          if (!status) return;

          // getting communications that were postponed after practitioner will become not busy
          if (practitioner?.id && communications && !busyPractitionerIds.has(practitioner.id)) {
            const postponedCommunications = communications.filter(
              (comm) =>
                comm.status === 'preparation' &&
                comm.recipient?.[0].reference &&
                !busyPractitionerIds.has(comm.recipient?.[0].reference)
            );
            postponedCommunications.forEach((communication) => {
              const communicationPractitionerUri = communication.recipient![0].reference!;
              const practitioner = allPractitionersIdMap[communicationPractitionerUri];
              const notificationSettings = getProviderNotificationSettingsForPractitioner(practitioner);
              if (notificationSettings && notificationSettings.enabled) {
                const newStatus = getCommunicationStatus(notificationSettings, busyPractitionerIds, practitioner);
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
                addNewSMSCommunicationForPractitioner(practitioner, communication, newStatus);
              }
            });
          }
          if (status === TelemedAppointmentStatusEnum.ready) {
            // check the tag presence that indicates that communications for "Patient is waiting" notification already exist
            const isProcessed = appointment.meta?.tag?.find(
              (tag) =>
                tag.system === PROVIDER_NOTIFICATION_TAG_SYSTEM &&
                tag.code === AppointmentProviderNotificationTags.patient_waiting
            );
            if (!isProcessed && location?.address?.state) {
              // add tag into appointment and add to batch request
              updateAppointmentRequests.push(
                getPatchBinary({
                  resourceId: appointment.id!,
                  resourceType: 'Appointment',
                  patchOperations: [
                    getPatchOperationForNewMetaTag(appointment, {
                      system: PROVIDER_NOTIFICATION_TAG_SYSTEM,
                      code: AppointmentProviderNotificationTags.patient_waiting,
                    }),
                  ],
                })
              );
              const providersToSendNotificationTo = statePractitionerMap[location.address?.state];
              if (providersToSendNotificationTo) {
                for (const provider of providersToSendNotificationTo) {
                  const notificationSettings = getProviderNotificationSettingsForPractitioner(provider);

                  // - if praictioner has notifications disabled - we don't create notification at all

                  if (notificationSettings?.enabled) {
                    const status = getCommunicationStatus(notificationSettings, busyPractitionerIds, provider);
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
                                code: AppointmentProviderNotificationTypes.patient_waiting,
                              },
                            ],
                          },
                        ],
                        sent: DateTime.utc().toISO()!,
                        // set status to "preparation" for practitioners that should not receive notifications right now
                        // and "in-progress" to those who should receive it right away
                        status: status,
                        encounter: { reference: `Encounter/${encounter.id}` },
                        recipient: [{ reference: `Practitioner/${provider.id}` }],
                        payload: [{ contentString: `New patient in ${location.address.state} is waiting` }],
                      },
                    };
                    createCommunicationRequests.push(request);

                    addNewSMSCommunicationForPractitioner(provider, request.resource as Communication, status);
                  }
                }
              }
            }
            // todo: go through communications and make sure everything was sent
          } else if (status === TelemedAppointmentStatusEnum.unsigned && practitioner) {
            // check that the appointment is more than >12 hours in the "unsigned" status
            // and that corresponding notifications were sent to providers

            const lastUnsignedStatus = encounter.statusHistory?.reduceRight(
              (found: EncounterStatusHistory | null, entry) => {
                if (found === null && entry.status === 'finished') {
                  return entry;
                }
                return found;
              },
              null
            );

            const utcNow = DateTime.utc();
            let isProcessed = true;
            let tagToLookFor: AppointmentProviderNotificationTags | undefined = undefined;
            // here we check that the appointment is in the unsigned status for > 12, 24 or 48 hours
            if (lastUnsignedStatus && !lastUnsignedStatus.period.end) {
              const unsignedPeriodStart = DateTime.fromISO(lastUnsignedStatus.period.start || utcNow.toISO()!);
              if (unsignedPeriodStart < DateTime.utc().minus({ hour: 48 })) {
                tagToLookFor = AppointmentProviderNotificationTags.unsigned_more_than_x_hours_3;
              } else if (unsignedPeriodStart < DateTime.utc().minus({ hour: 24 })) {
                tagToLookFor = AppointmentProviderNotificationTags.unsigned_more_than_x_hours_2;
              } else if (unsignedPeriodStart < DateTime.utc().minus({ hour: 12 })) {
                tagToLookFor = AppointmentProviderNotificationTags.unsigned_more_than_x_hours_1;
              }
            }

            if (tagToLookFor) {
              isProcessed = Boolean(
                appointment.meta?.tag?.find(
                  (tag) => tag.system === PROVIDER_NOTIFICATION_TAG_SYSTEM && tag.code === tagToLookFor
                )
              );
              if (!practitionerUnsignedTooLongAppoitmentPackagesMap[practitioner.id!]) {
                practitionerUnsignedTooLongAppoitmentPackagesMap[practitioner.id!] = [];
              }
              practitionerUnsignedTooLongAppoitmentPackagesMap[practitioner.id!].push({
                pack: readyOrUnsignedVisitPackages[appointmentId],
                isProcessed: Boolean(isProcessed),
              });

              if (!isProcessed) {
                // add tag into appointment that the >x hours unsigned status notification was processed
                // and add to batch request
                updateAppointmentRequests.push(
                  getPatchBinary({
                    resourceId: appointment.id!,
                    resourceType: 'Appointment',
                    patchOperations: [
                      getPatchOperationForNewMetaTag(appointment, {
                        system: PROVIDER_NOTIFICATION_TAG_SYSTEM,
                        code: tagToLookFor,
                      }),
                    ],
                  })
                );
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error trying to process notifications for appointment ${appointmentId}`, error);
      }
    });

    console.log(`Too long unsigned appointments: ${JSON.stringify(practitionerUnsignedTooLongAppoitmentPackagesMap)}`);
    Object.keys(practitionerUnsignedTooLongAppoitmentPackagesMap).forEach((practitionerId) => {
      const unsignedPractitionerAppointments = practitionerUnsignedTooLongAppoitmentPackagesMap[practitionerId];
      let hasUnprocessed = false;
      let practitionerResource: Practitioner | undefined = undefined;
      let encounterResource: Encounter | undefined = undefined;
      for (const appt of unsignedPractitionerAppointments) {
        const { pack, isProcessed } = appt;
        const { practitioner, encounter } = pack;
        if (!practitionerResource && practitioner) {
          practitionerResource = practitioner;
        }
        if (!encounterResource && encounter) {
          encounterResource = encounter;
        }
        if (!isProcessed) {
          hasUnprocessed = true;
        }
      }

      if (hasUnprocessed && checkPractitionerResourceDefined(practitionerResource)) {
        // create notification for practitioner that was assigned to this visit
        const notificationSettings = getProviderNotificationSettingsForPractitioner(practitionerResource);
        // rules of status described above
        if (notificationSettings?.enabled) {
          const status = getCommunicationStatus(notificationSettings, busyPractitionerIds, practitionerResource);
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
                      code: AppointmentProviderNotificationTypes.unsigned_charts,
                    },
                  ],
                },
              ],
              sent: DateTime.utc().toISO()!,
              // set status to "preparation" for practitioners that should not receive notifications right now
              // and "in-progress" to those who should receive it right away
              status: status,
              encounter: encounterResource
                ? {
                    reference: `Encounter/${encounterResource.id}`,
                  }
                : undefined,
              recipient: [{ reference: `Practitioner/${practitionerResource.id}` }],
              payload: [
                {
                  contentString: `You have ${unsignedPractitionerAppointments.length} unsigned charts on ET. Please complete and sign ASAP. Thanks!`,
                },
              ],
            },
          };

          createCommunicationRequests.push(request);

          if (
            status === 'completed' ||
            (status === 'in-progress' &&
              notificationSettings.method === ProviderNotificationMethod['phone and computer'])
          ) {
            // not to send multiple notifications of the same "Unsigned charts" type by sms one by one - check if theres any and update
            const existingUnsignedNotificationPending = sendSMSPractitionerCommunications[
              practitionerResource.id!
            ].communications.find(
              (comm) =>
                comm.category?.[0].coding?.[0].system === PROVIDER_NOTIFICATION_TYPE_SYSTEM &&
                comm.category?.[0].coding?.[0].code === AppointmentProviderNotificationTypes.unsigned_charts
            );
            if (existingUnsignedNotificationPending?.payload?.[0]) {
              existingUnsignedNotificationPending.payload[0].contentString = `You have ${unsignedPractitionerAppointments.length} unsigned charts on ET. Please complete and sign ASAP. Thanks!`;
            } else {
              addOrUpdateSMSPractitionerCommunications(request.resource as Communication, practitionerResource);
            }
          }
        }
      }
    });

    // here we need to send SMS to practitioners that are not busy and has some unprocessed communications
    const sendSMSRequests: Promise<unknown>[] = [];
    if (Object.keys(sendSMSPractitionerCommunications).length > 0) {
      Object.keys(sendSMSPractitionerCommunications).forEach((id) => {
        try {
          const { practitioner, communications } = sendSMSPractitionerCommunications[id];
          const notificationSettings = getProviderNotificationSettingsForPractitioner(practitioner);
          if (
            (practitioner.telecom?.find((tel) => tel.system === 'sms' && Boolean(tel.value)) &&
              notificationSettings?.method === ProviderNotificationMethod.phone) ||
            notificationSettings?.method === ProviderNotificationMethod['phone and computer']
          ) {
            communications.forEach((comm) => {
              if (comm.payload?.[0].contentString) {
                sendSMSRequests.push(
                  oystehr.transactionalSMS.send({
                    resource: `Practitioner/${practitioner.id!}`,
                    message: comm.payload?.[0].contentString,
                  })
                );
              }
            });
          }
        } catch (error) {
          console.error(
            `Error trying to send SMS notifications for practitioner ${sendSMSPractitionerCommunications[id].practitioner.id}`,
            error
          );
        }
      });
    }

    console.log(`Update appointment requests: ${JSON.stringify(updateAppointmentRequests)}`);
    console.log(`Create communications requests: ${JSON.stringify(createCommunicationRequests)}`);

    try {
      const requests: Promise<unknown>[] = [];
      if (
        updateAppointmentRequests.length > 0 ||
        createCommunicationRequests.length > 0 ||
        updateCommunicationRequests.length > 0
      ) {
        requests.push(
          oystehr.fhir.transaction<Appointment | Communication>({
            requests: [...updateAppointmentRequests, ...createCommunicationRequests, ...updateCommunicationRequests],
          })
        );
      }
      if (sendSMSRequests.length > 0) {
        requests.push(...sendSMSRequests);
      }
      await Promise.all([...requests]);
    } catch (e) {
      console.log(
        'Error trying to create/update notifications related resources, or send sms notifications',
        JSON.stringify(e)
      );
      throw e;
    }

    return {
      statusCode: 200,
      body: 'Successfully processed provider notifications',
    };
  } catch (error: any) {
    await topLevelCatch('Notification-updater', error, input.secrets);
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify(error.message),
    };
  }
};

function checkPractitionerResourceDefined(resource: Practitioner | undefined | never): resource is Practitioner {
  return resource !== undefined;
}

interface ResourcePackage {
  appointment?: Appointment;
  encounter?: Encounter;
  communications: Communication[];
  practitioner?: Practitioner;
  location?: Location;
}

type ResourcePackagesMap = { [key: NonNullable<Appointment['id']>]: ResourcePackage };

/** Getting apppointments with status "Arrived" and encounter with statuses
 * that correspond to Telemed statuses "ready", "pre-video", "on-video", "unsigned".
 * Include related encounter, patient, provider and communication
 */
async function getResourcePackagesAppointmentsMap(
  oystehr: Oystehr,
  statuses: Encounter['status'][],
  fromDate: DateTime
): Promise<ResourcePackagesMap> {
  const results = (
    await oystehr.fhir.search<Appointment | Communication | Encounter | Location | Practitioner>({
      resourceType: 'Appointment',
      params: [
        { name: '_tag', value: OTTEHR_MODULE.TM },
        {
          name: 'date',
          value: `ge${fromDate}`,
        },
        {
          name: 'status',
          value: `arrived`,
        },
        {
          name: '_revinclude',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Encounter:participant:Practitioner',
        },
        {
          name: '_include',
          value: 'Appointment:location',
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
  const practitionerIdMap: { [key: NonNullable<Practitioner['id']>]: Practitioner } = {};
  const locationIdMap: { [key: NonNullable<Location['id']>]: Location } = {};
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
    } else if (res.resourceType === 'Practitioner') {
      // create practitioners id map for later optimized mapping
      const practitioner = res as Practitioner;
      practitionerIdMap[practitioner.id!] = practitioner;
    } else if (res.resourceType === 'Location') {
      // create locations id map for later optimized mapping
      const location = res as Location;
      locationIdMap[location.id!] = location;
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

  // fill in practitioners and locations
  Object.keys(resourcePackagesMap).forEach((appointmentId) => {
    const encounter = resourcePackagesMap[appointmentId].encounter;
    const practitionerReference = encounter?.participant?.find(
      (participant) => participant.individual?.reference?.startsWith('Practitioner')
    )?.individual?.reference;
    if (practitionerReference) {
      const practitionerId = removePrefix('Practitioner/', practitionerReference);
      if (practitionerId) {
        const pack = getOrCreateAppointmentResourcePackage(appointmentId);
        pack.practitioner = practitionerIdMap[practitionerId];
        resourcePackagesMap[appointmentId] = pack;
      }
    }
    const locationReference = encounter?.location?.find((loc) => loc.location.reference)?.location.reference;
    if (locationReference) {
      const locationId = removePrefix('Location/', locationReference);
      if (locationId) {
        const pack = getOrCreateAppointmentResourcePackage(appointmentId);
        pack.location = locationIdMap[locationId];
        resourcePackagesMap[appointmentId] = pack;
      }
    }
  });

  return resourcePackagesMap;
}

const getPractitionersByStatesMap = async (oystehr: Oystehr): Promise<StatePractitionerMap> => {
  const [employees, roles] = await Promise.all([await getEmployees(oystehr), await getRoles(oystehr)]);

  const inactiveRoleId = roles.find((role: any) => role.name === RoleType.Inactive)?.id;
  const providerRoleId = roles.find((role: any) => role.name === RoleType.Provider)?.id;
  if (!inactiveRoleId || !providerRoleId) {
    throw new Error('Error searching for Inactive or Provider role.');
  }

  console.log('Preparing the FHIR batch request.');

  const practitionerIds = employees.map((employee) => employee.profile.split('/')[1]);

  const [inactiveRoleMembers, providerRoleMembers, practitionerResources] = await Promise.all([
    getRoleMembers(inactiveRoleId, oystehr),
    getRoleMembers(providerRoleId, oystehr),
    oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [
        {
          name: '_id',
          value: practitionerIds.join(','),
        },
      ],
    }),
  ]);

  console.log(
    `Fetched ${inactiveRoleMembers.length} Inactive and ${providerRoleMembers.length} Provider role members.`
  );

  console.log(`provider roles members: ${JSON.stringify(providerRoleMembers)}`);
  // map for getting inactive users by user id
  const inactiveUsersMap = new Map(inactiveRoleMembers.map((user) => [user.id, user]));
  // map for getting users that have Provider role by user id
  const providerUsersMap = new Map(providerRoleMembers.map((user) => [user.id, user]));

  // map for getting Practitioner resource associated with a user by user id
  const userIdPractitionerMap: { [key: string]: Practitioner } = {};
  for (const entry of providerUsersMap.entries()) {
    const [userId, user] = entry;
    const practitionerId = removePrefix('Practitioner/', user.profile || '');
    if (!practitionerId) continue;
    const practitioner = practitionerResources.unbundle().find((res) => res.id === practitionerId);
    if (practitioner) {
      userIdPractitionerMap[userId] = practitioner;
    }
  }
  // map for getting active practitioners that can operate in each state
  const statePractitionerMap: StatePractitionerMap = {};
  console.log(`User id to practitioner map: ${JSON.stringify(userIdPractitionerMap)}`);

  employees.forEach((employee) => {
    const isActive = !inactiveUsersMap.has(employee.id);
    const isProvider = !providerUsersMap.has(employee.id);
    if (!isActive && !isProvider) {
      return;
    }
    const practitioner = userIdPractitionerMap[employee.id];

    const licenses = allLicensesForPractitioner(practitioner);
    licenses.forEach((license) => {
      addPractitionerToState(statePractitionerMap, license.state, practitioner);
    });
  });
  return statePractitionerMap;
};

type StatePractitionerMap = { [key: string]: Practitioner[] };

function addPractitionerToState(
  statesPractitionersMap: StatePractitionerMap,
  state: string,
  practitioner: Practitioner
): void {
  if (!statesPractitionersMap[state]) {
    statesPractitionersMap[state] = [];
  }

  statesPractitionersMap[state].push(practitioner);
}

// set the status of communication:
// - if practitioner is not busy and notificatios enabled - set it to in-progress
// - if practitioner is busy - set it to "preparation"
// - if provider has only "mobile" notification type - we can set the status to "completed" and
// send the notification to mobile right away
function getCommunicationStatus(
  notificationSettings: ProviderNotificationSettings,
  busyPractitionerIds: Set<string>,
  practitioner: Practitioner | undefined
): Communication['status'] {
  let status: Communication['status'] = 'in-progress';
  if (busyPractitionerIds.has(practitioner?.id || '')) {
    status = 'preparation';
  } else if (notificationSettings.method === ProviderNotificationMethod.phone) {
    status = 'completed';
  }
  return status;
}
