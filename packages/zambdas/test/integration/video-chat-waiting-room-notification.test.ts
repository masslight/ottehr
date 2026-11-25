import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource, Location, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
  VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_TYPE,
} from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { OttehrTaskSystem } from 'utils/lib/types/common';
import { TELEMED_VIDEO_ROOM_CODE } from 'utils/lib/types/constants';
import { VideoChatNotificationResponse } from 'utils/lib/types/data/telemed/video-chat-invites.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENCOUNTER_VS_EXTENSION_URL } from '../../src/shared/constants';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

interface TelemedVisit {
  patient: Patient;
  location: Location;
  appointment: Appointment;
  encounter: Encounter;
}

const createBookedTelemedVisit = async (oystehr: Oystehr, processId: string): Promise<TelemedVisit> => {
  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const start = DateTime.now().toUTC();
  const bundle = await oystehr.fhir.transaction<FhirResource>({
    requests: [
      {
        method: 'POST',
        url: '/Location',
        fullUrl: 'urn:uuid:location',
        resource: tag<Location>({ resourceType: 'Location', status: 'active', name: 'Waiting Room Test State' }),
      },
      {
        method: 'POST',
        url: '/Patient',
        fullUrl: 'urn:uuid:patient',
        resource: tag<Patient>({
          resourceType: 'Patient',
          active: true,
          name: [{ given: ['Arya'], family: 'Stark' }],
          birthDate: '2010-04-04',
        }),
      },
      {
        method: 'POST',
        url: '/Appointment',
        fullUrl: 'urn:uuid:appointment',
        resource: tag<Appointment>({
          resourceType: 'Appointment',
          meta: { tag: [{ code: OTTEHR_MODULE.TM }] },
          status: 'booked',
          start: start.toISO()!,
          end: start.plus({ minutes: 15 }).toISO()!,
          participant: [
            { actor: { reference: 'urn:uuid:patient' }, status: 'accepted' },
            { actor: { reference: 'urn:uuid:location' }, status: 'accepted' },
          ],
        }),
      },
      {
        method: 'POST',
        url: '/Encounter',
        resource: tag<Encounter>({
          resourceType: 'Encounter',
          status: 'planned',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
          subject: { reference: 'urn:uuid:patient' },
          appointment: [{ reference: 'urn:uuid:appointment' }],
          extension: [
            {
              url: ENCOUNTER_VS_EXTENSION_URL,
              extension: [
                {
                  url: 'channelType',
                  valueCoding: {
                    system: 'https://fhir.zapehr.com/virtual-service-type',
                    code: TELEMED_VIDEO_ROOM_CODE,
                  },
                },
              ],
            },
          ],
        }),
      },
    ],
  });

  const resources = bundle.entry!.map((entry) => entry.resource!);
  return {
    patient: resources.find((r): r is Patient => r.resourceType === 'Patient')!,
    location: resources.find((r): r is Location => r.resourceType === 'Location')!,
    appointment: resources.find((r): r is Appointment => r.resourceType === 'Appointment')!,
    encounter: resources.find((r): r is Encounter => r.resourceType === 'Encounter')!,
  };
};

const findNotificationTasks = async (oystehr: Oystehr, appointmentId: string): Promise<Task[]> =>
  (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'focus', value: `Appointment/${appointmentId}` },
        { name: 'code', value: `${OttehrTaskSystem}|${VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE}` },
      ],
    })
  ).unbundle();

describe('video-chat-waiting-room-notification integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let visit: TelemedVisit;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('video-chat-waiting-room-notification.test.ts', M2MClientMockType.patient);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    visit = await createBookedTelemedVisit(oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    const tasks = visit?.appointment.id ? await findNotificationTasks(oystehr, visit.appointment.id) : [];
    await Promise.all(tasks.map((task) => oystehr.fhir.delete({ resourceType: 'Task', id: task.id! })));
    await cleanup();
  });

  it('creates the provider notification task and moves the booked visit to arrived', async () => {
    const { status, output } = await oystehrZambdas.zambda.executePublic({
      id: 'video-chat-waiting-room-notification',
      appointmentId: visit.appointment.id,
    });

    expect(status).toBe(200);
    expect(output as VideoChatNotificationResponse).toEqual({ taskCreated: true });

    const [tasks, appointment, encounter] = await Promise.all([
      findNotificationTasks(oystehr, visit.appointment.id!),
      oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: visit.appointment.id! }),
      oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: visit.encounter.id! }),
    ]);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      status: 'requested',
      description: 'Arya Stark is ready to begin their virtual visit.',
      encounter: { reference: `Encounter/${visit.encounter.id}` },
      requester: { reference: `Patient/${visit.patient.id}` },
      location: { reference: `Location/${visit.location.id}` },
    });

    expect(appointment.status).toBe('arrived');
    expect(appointment.meta?.tag).toEqual(
      expect.arrayContaining([
        {
          system: VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_TYPE,
          code: VIDEO_CHAT_WAITING_ROOM_NOTIFICATION_TASK_CODE,
        },
      ])
    );
    expect(encounter.status).toBe('arrived');
    expect(encounter.statusHistory?.at(-1)?.status).toBe('arrived');
  });
});
