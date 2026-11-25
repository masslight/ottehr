import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, FhirResource, Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PARTICIPATION_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { TELEMED_VIDEO_ROOM_CODE } from 'utils/lib/types/constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENCOUNTER_VS_EXTENSION_URL } from '../../src/shared/constants';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

interface TelemedVisit {
  appointment: Appointment;
  encounter: Encounter;
  invitees: RelatedPerson[];
}

const createTelemedVisitWithInvitees = async (
  oystehr: Oystehr,
  processId: string,
  inviteeEmails: string[]
): Promise<TelemedVisit> => {
  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const start = DateTime.now().toUTC();
  const inviteeRequests: BatchInputPostRequest<FhirResource>[] = inviteeEmails.map((email, index) => ({
    method: 'POST',
    url: '/RelatedPerson',
    fullUrl: `urn:uuid:invitee-${index}`,
    resource: tag<RelatedPerson>({
      resourceType: 'RelatedPerson',
      active: true,
      patient: { reference: 'urn:uuid:patient' },
      name: [{ given: [`Guest ${index}`], family: 'Stark' }],
      relationship: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: 'WIT' }] }],
      telecom: [{ system: 'email', value: email }],
    }),
  }));

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
      ...inviteeRequests,
      {
        method: 'POST',
        url: '/Encounter',
        resource: tag<Encounter>({
          resourceType: 'Encounter',
          status: 'in-progress',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
          subject: { reference: 'urn:uuid:patient' },
          appointment: [{ reference: 'urn:uuid:appointment' }],
          participant: inviteeRequests.map((request) => ({ individual: { reference: request.fullUrl } })),
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
    appointment: resources.find((r): r is Appointment => r.resourceType === 'Appointment')!,
    encounter: resources.find((r): r is Encounter => r.resourceType === 'Encounter')!,
    invitees: inviteeEmails.map(
      (email) =>
        resources.find(
          (r): r is RelatedPerson =>
            r.resourceType === 'RelatedPerson' && r.telecom?.some((telecom) => telecom.value === email) === true
        )!
    ),
  };
};

describe('video-chat-invites-cancel integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let visit: TelemedVisit;
  const cancelledEmail = `cancelled-${randomUUID()}@example.com`;
  const keptEmail = `kept-${randomUUID()}@example.com`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('video-chat-invites-cancel.test.ts', M2MClientMockType.patient);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    visit = await createTelemedVisitWithInvitees(oystehr, setup.processId, [cancelledEmail, keptEmail]);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('removes the invitee matched by email from the video encounter participants', async () => {
    const { status } = await oystehrZambdas.zambda.execute({
      id: 'video-chat-invites-cancel',
      appointmentId: visit.appointment.id,
      emailAddress: cancelledEmail,
    });

    expect(status).toBe(200);
    const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: visit.encounter.id! });
    expect(encounter.participant?.map((participant) => participant.individual?.reference)).toEqual([
      `RelatedPerson/${visit.invitees[1].id}`,
    ]);
  });
});
