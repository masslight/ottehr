import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, FhirResource, Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PARTICIPATION_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { TELEMED_VIDEO_ROOM_CODE } from 'utils/lib/types/constants';
import { ListInvitedParticipantsResponse } from 'utils/lib/types/data/telemed/video-chat-invites.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENCOUNTER_VS_EXTENSION_URL } from '../../src/shared/constants';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

interface Invitee {
  given: string;
  family: string;
  email: string;
  phone: string;
}

const createTelemedVisitWithInvitees = async (
  oystehr: Oystehr,
  processId: string,
  invitees: Invitee[]
): Promise<Appointment> => {
  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const start = DateTime.now().toUTC();
  const inviteeRequests: BatchInputPostRequest<FhirResource>[] = invitees.map((invitee, index) => ({
    method: 'POST',
    url: '/RelatedPerson',
    fullUrl: `urn:uuid:invitee-${index}`,
    resource: tag<RelatedPerson>({
      resourceType: 'RelatedPerson',
      active: true,
      patient: { reference: 'urn:uuid:patient' },
      name: [{ given: [invitee.given], family: invitee.family }],
      relationship: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: 'WIT' }] }],
      telecom: [
        { system: 'email', value: invitee.email },
        { system: 'phone', value: invitee.phone },
        { system: 'sms', value: invitee.phone },
      ],
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

  return bundle.entry!.map((entry) => entry.resource!).find((r): r is Appointment => r.resourceType === 'Appointment')!;
};

describe('video-chat-invites-list integration', () => {
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let appointment: Appointment;
  const suffix = randomUUID();
  const invitees: Invitee[] = [
    { given: 'Sansa', family: 'Stark', email: `sansa-${suffix}@example.com`, phone: '2125550101' },
    { given: 'Bran', family: 'Stark', email: `bran-${suffix}@example.com`, phone: '2125550102' },
  ];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('video-chat-invites-list.test.ts', M2MClientMockType.patient);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    appointment = await createTelemedVisitWithInvitees(setup.oystehr, setup.processId, invitees);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it("lists the invitees of the appointment's video encounter", async () => {
    const { status, output } = await oystehrZambdas.zambda.execute({
      id: 'video-chat-invites-list',
      appointmentId: appointment.id,
    });

    expect(status).toBe(200);
    const { invites } = output as ListInvitedParticipantsResponse;
    expect(invites).toHaveLength(2);
    expect(invites).toEqual(
      expect.arrayContaining([
        { firstName: 'Sansa', lastName: 'Stark', emailAddress: invitees[0].email, phoneNumber: '(212) 555-0101' },
        { firstName: 'Bran', lastName: 'Stark', emailAddress: invitees[1].email, phoneNumber: '(212) 555-0102' },
      ])
    );
  });
});
