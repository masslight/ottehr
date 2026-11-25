import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Encounter, RelatedPerson } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PRIVATE_EXTENSION_BASE_URL, PUBLIC_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { InitTelemedSessionResponse } from 'utils/lib/types/api/init-telemed-session/init-telemed-session.types';
import { TELEMED_VIDEO_ROOM_CODE } from 'utils/lib/types/constants';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/init-telemed-session/index';
import { SECRETS } from '../data/secrets';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

interface TelemedRequest {
  url: string;
  method: string;
  authorization: string | undefined;
  body?: { encounter: Encounter; recordAudio: boolean };
}

const MEETING_URL = `${SECRETS.PROJECT_API}/telemed/v2/meeting`;

describe('init-telemed-session integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let userRelatedPerson: RelatedPerson;
  const telemedRequests: TelemedRequest[] = [];
  const meetingData = { Meeting: { MeetingId: randomUUID() }, Attendee: { AttendeeId: randomUUID() } };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('init-telemed-session.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);

    [userRelatedPerson] = await Promise.all([
      oystehr.fhir.create<RelatedPerson>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'RelatedPerson',
            patient: { reference: `Patient/${base.patient.id}` },
            relationship: [
              { coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] },
            ],
          },
          setup.processId
        ) as RelatedPerson
      ),
      oystehr.fhir.patch<Encounter>({
        resourceType: 'Encounter',
        id: base.encounter.id!,
        operations: [
          {
            op: 'add',
            path: '/extension/-',
            value: {
              url: `${PUBLIC_EXTENSION_BASE_URL}/encounter-virtual-service-pre-release`,
              extension: [{ url: 'channelType', valueCoding: { code: TELEMED_VIDEO_ROOM_CODE } }],
            },
          },
        ],
      }),
    ]);
  }, 60_000);

  beforeEach(() => {
    telemedRequests.length = 0;
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith(MEETING_URL)) return realFetch(input, init);
      const headers = new Headers(init?.headers);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      telemedRequests.push({
        url,
        method: init?.method ?? 'GET',
        authorization: headers.get('Authorization') ?? undefined,
        body,
      });
      const responseBody = url === MEETING_URL ? { encounter: body.encounter } : meetingData;
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('creates the video room for the visit encounter with the patient users and joins it as the caller', async () => {
    const { statusCode, output } = await invokeZambdaHandler<InitTelemedSessionResponse>(
      index,
      { appointmentId: base.appointment.id, userId: randomUUID() },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({ meetingData, encounterId: base.encounter.id });

    expect(telemedRequests.map(({ url, method }) => ({ url, method }))).toEqual([
      { url: MEETING_URL, method: 'POST' },
      { url: `${MEETING_URL}/${base.encounter.id}/join`, method: 'GET' },
    ]);
    const [createRoom, joinRoom] = telemedRequests;
    expect(createRoom.body?.recordAudio).toBe(true);
    expect(createRoom.body?.encounter.id).toBe(base.encounter.id);
    expect(createRoom.body?.encounter.participant).toEqual([
      { individual: { reference: `RelatedPerson/${userRelatedPerson.id}` } },
    ]);
    expect(createRoom.authorization).toMatch(/^Bearer \S+$/);
    expect(createRoom.authorization).not.toBe(`Bearer ${token}`);
    expect(joinRoom.authorization).toBe(`Bearer ${token}`);
  });
});
