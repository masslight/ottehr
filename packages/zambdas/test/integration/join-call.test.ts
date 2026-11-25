import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, FhirResource, Patient, Person, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType, userMe } from 'utils/lib/auth/user-me.helper';
import { FHIR_EXTENSION, PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { TELEMED_VIDEO_ROOM_CODE } from 'utils/lib/types/constants';
import { JoinCallResponse } from 'utils/lib/types/data/telemed/join-call.types';
import { afterAll, beforeAll, describe, expect, it, MockInstance, vi } from 'vitest';
import { index } from '../../src/patient/join-call/index';
import { ENCOUNTER_VS_EXTENSION_URL } from '../../src/shared/constants';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

interface VideoVisit {
  appointment: Appointment;
  encounter: Encounter;
  userRelatedPerson: RelatedPerson;
}

const createVideoVisitInProgress = async (
  oystehr: Oystehr,
  processId: string,
  callerPhone: string
): Promise<VideoVisit> => {
  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const start = DateTime.now().toUTC();
  const bundle = await oystehr.fhir.transaction<FhirResource>({
    requests: [
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
          status: 'arrived',
          start: start.toISO()!,
          end: start.plus({ minutes: 15 }).toISO()!,
          participant: [{ actor: { reference: 'urn:uuid:patient' }, status: 'accepted' }],
        }),
      },
      {
        method: 'POST',
        url: '/Encounter',
        resource: tag<Encounter>({
          resourceType: 'Encounter',
          status: 'in-progress',
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
                { url: 'addressString', valueString: `meeting-${randomUUID()}` },
              ],
            },
          ],
        }),
      },
      {
        method: 'POST',
        url: '/RelatedPerson',
        fullUrl: 'urn:uuid:user-related-person',
        resource: tag<RelatedPerson>({
          resourceType: 'RelatedPerson',
          patient: { reference: 'urn:uuid:patient' },
          relationship: [
            { coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] },
          ],
          telecom: [{ system: 'phone', value: callerPhone }],
        }),
      },
      {
        method: 'POST',
        url: '/Person',
        resource: tag<Person>({
          resourceType: 'Person',
          telecom: [{ system: 'phone', value: callerPhone }],
          link: [{ target: { reference: 'urn:uuid:user-related-person' } }],
        }),
      },
    ],
  });
  const resources = bundle.entry!.map((entry) => entry.resource!);
  return {
    appointment: resources.find((r): r is Appointment => r.resourceType === 'Appointment')!,
    encounter: resources.find((r): r is Encounter => r.resourceType === 'Encounter')!,
    userRelatedPerson: resources.find((r): r is RelatedPerson => r.resourceType === 'RelatedPerson')!,
  };
};

const otherParticipantReferences = (encounter: Encounter): (string | undefined)[] =>
  (encounter.extension ?? [])
    .filter((extension) => extension.url === FHIR_EXTENSION.Encounter.otherParticipants.url)
    .flatMap((extension) => extension.extension ?? [])
    .map((participant) => participant.extension?.find((inner) => inner.url === 'reference')?.valueReference?.reference);

describe('join-call integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let profile: string;
  let cleanup: () => Promise<void>;
  let visit: VideoVisit;
  let joinMeeting: MockInstance;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('join-call.test.ts', M2MClientMockType.patient);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    profile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;
    const caller = await userMe(token, loadZambdaSecrets());
    visit = await createVideoVisitInProgress(oystehr, setup.processId, caller.name);
    joinMeeting = vi.spyOn(Object.getPrototypeOf(new Oystehr({}).telemed), 'joinMeeting');
  }, 60_000);

  afterAll(async () => {
    joinMeeting?.mockRestore();
    await cleanup();
  });

  it("adds the patient's user to the video encounter and joins the meeting with the caller's token", async () => {
    const meeting: JoinCallResponse = { Meeting: { MeetingId: 'meeting-1' }, Attendee: { AttendeeId: 'attendee-1' } };
    joinMeeting.mockResolvedValueOnce(meeting);

    const { statusCode, output } = await invokeZambdaHandler<JoinCallResponse>(
      index,
      { appointmentId: visit.appointment.id },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual(meeting);
    expect(joinMeeting).toHaveBeenCalledWith(
      { encounterId: visit.encounter.id, anonymous: false },
      { accessToken: token }
    );

    const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: visit.encounter.id! });
    expect(encounter.participant?.map((participant) => participant.individual?.reference)).toEqual([
      `RelatedPerson/${visit.userRelatedPerson.id}`,
    ]);
    expect(otherParticipantReferences(encounter)).toEqual([profile]);
  });
});
