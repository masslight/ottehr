import Oystehr, { User } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Communication, Location, Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { TASK_INPUT_SYSTEM } from 'utils/lib/fhir/constants';
import { GetSupportChatResponse, SUPPORT_CHAT_THREAD_SYSTEM } from 'utils/lib/types/api/support-chat.types';
import { MANUAL_TASK } from 'utils/lib/types/data/tasks/types';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/support-chat/reply-support-chat/index';
import { buildThreadMessage, makeThreadTag } from '../../src/shared/support-chat/thread';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const { getUser, sendGenericOutreachEmail } = vi.hoisted(() => ({
  getUser: vi.fn(),
  sendGenericOutreachEmail: vi.fn(),
}));

vi.mock('../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/auth')>()),
  getUser,
}));

vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/communication')>()),
  getEmailClient: () => ({ sendGenericOutreachEmail }),
}));

describe('reply-support-chat integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let staff: Practitioner;
  let location: Location;
  let task: Task;
  let patientMessage: Communication;
  const threadId = randomUUID();
  const staffLastName = `Agent${randomUUID().slice(0, 8)}`;
  const supportPhone = '(212) 555-0100';

  beforeAll(async () => {
    const setup = await setupIntegrationTest('reply-support-chat.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);

    [staff, location] = await Promise.all([
      oystehr.fhir.create<Practitioner>(
        addProcessIdMetaTagToResource(
          { resourceType: 'Practitioner', name: [{ given: ['Support'], family: staffLastName }] },
          setup.processId
        ) as Practitioner
      ),
      oystehr.fhir.create<Location>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Location',
            status: 'active',
            name: `Support Clinic ${randomUUID().slice(0, 8)}`,
            extension: [{ url: LOCATION_SUPPORT_PHONE_EXTENSION_URL, valueString: supportPhone }],
          },
          setup.processId
        ) as Location
      ),
    ]);

    task = await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          meta: { tag: [makeThreadTag(threadId)] },
          status: 'requested',
          intent: 'order',
          description: 'Refill request',
          location: { reference: `Location/${location.id}` },
          input: [
            {
              type: { coding: [{ system: TASK_INPUT_SYSTEM, code: MANUAL_TASK.input.patient }] },
              valueReference: { reference: `Patient/${base.patient.id}` },
            },
          ],
        },
        setup.processId
      ) as Task
    );

    patientMessage = await oystehr.fhir.create<Communication>(
      addProcessIdMetaTagToResource(
        buildThreadMessage({
          threadId,
          kind: 'text',
          text: 'Can I get a refill?',
          sent: DateTime.now().minus({ minutes: 5 }).toISO()!,
          sender: { reference: `Patient/${base.patient.id}`, display: 'Jon Snow' },
          patientId: base.patient.id,
        }),
        setup.processId
      ) as Communication
    );

    getUser.mockResolvedValue({
      id: randomUUID(),
      name: 'support.agent@example.com',
      email: 'support.agent@example.com',
      phoneNumber: null,
      authenticationMethod: 'email',
      profile: `Practitioner/${staff.id}`,
      roles: [],
    } as unknown as User);
    sendGenericOutreachEmail.mockResolvedValue(undefined);
  }, 60_000);

  afterAll(async () => {
    const threadMessages = (
      await oystehr.fhir.search<Communication>({
        resourceType: 'Communication',
        params: [{ name: '_tag', value: `${SUPPORT_CHAT_THREAD_SYSTEM}|${threadId}` }],
      })
    ).unbundle();
    for (const message of threadMessages) {
      await oystehr.fhir.delete({ resourceType: 'Communication', id: message.id! }).catch(() => undefined);
    }
    if (task?.id) await oystehr.fhir.delete({ resourceType: 'Task', id: task.id }).catch(() => undefined);
    if (location?.id) {
      await oystehr.fhir.delete({ resourceType: 'Location', id: location.id }).catch(() => undefined);
    }
    if (staff?.id) await oystehr.fhir.delete({ resourceType: 'Practitioner', id: staff.id }).catch(() => undefined);
    await cleanup();
  });

  it('posts the staff reply to the thread, emails the patient and returns the whole thread', async () => {
    const text = `Your refill is ready ${randomUUID().slice(0, 8)}`;
    const { statusCode, output } = await invokeZambdaHandler<GetSupportChatResponse>(
      index,
      { taskId: task.id, text },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output.isAvailable).toBe(true);
    expect(output.unreadCount).toBe(1);
    expect(output.messages).toEqual([
      expect.objectContaining({ id: patientMessage.id, author: 'patient', text: 'Can I get a refill?' }),
      expect.objectContaining({
        author: 'staff',
        authorName: `Support ${staffLastName}`,
        kind: 'text',
        text,
        isRead: false,
      }),
    ]);

    const reply = await oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: output.messages[1].id });
    expect(reply).toMatchObject({
      sender: { reference: `Practitioner/${staff.id}` },
      subject: { reference: `Patient/${base.patient.id}` },
      about: [{ reference: `Task/${task.id}`, display: 'Refill request' }],
    });

    expect(sendGenericOutreachEmail).toHaveBeenCalledTimes(1);
    const [email, templateData] = sendGenericOutreachEmail.mock.calls[0];
    expect(email).toBe('john.doe@example.com');
    expect(templateData['subject-text']).toBe(`You have a new message from ${location.name}`);
    expect(templateData.content).toContain(supportPhone);
  });
});
