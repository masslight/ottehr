import Oystehr from '@oystehr/sdk';
import { Communication, FhirResource, Patient, Person, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType, userMe } from 'utils/lib/auth/user-me.helper';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildThreadMessage } from '../../src/shared/support-chat/thread';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

interface ChatAccount {
  patient: Patient;
  relatedPerson: RelatedPerson;
  person: Person;
}

const createChatAccount = async (oystehr: Oystehr, processId: string, callerEmail: string): Promise<ChatAccount> => {
  const tag = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
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
        url: '/RelatedPerson',
        fullUrl: 'urn:uuid:user-related-person',
        resource: tag<RelatedPerson>({
          resourceType: 'RelatedPerson',
          patient: { reference: 'urn:uuid:patient' },
          relationship: [
            { coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] },
          ],
          telecom: [{ system: 'email', value: callerEmail }],
        }),
      },
      {
        method: 'POST',
        url: '/Person',
        resource: tag<Person>({
          resourceType: 'Person',
          telecom: [{ system: 'email', value: callerEmail }],
          link: [{ target: { reference: 'urn:uuid:user-related-person' } }],
        }),
      },
    ],
  });
  const resources = bundle.entry!.map((entry) => entry.resource!);
  return {
    patient: resources.find((r): r is Patient => r.resourceType === 'Patient')!,
    relatedPerson: resources.find((r): r is RelatedPerson => r.resourceType === 'RelatedPerson')!,
    person: resources.find((r): r is Person => r.resourceType === 'Person')!,
  };
};

describe('mark-support-chat-read integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let account: ChatAccount;
  let staffMessage: Communication;
  let patientMessage: Communication;

  beforeAll(async () => {
    // Test M2M users are never staff, so the provider mock reads its chat as a patient keyed by its own email.
    const setup = await setupIntegrationTest('mark-support-chat-read.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;

    const caller = await userMe(setup.testUserM2MToken, loadZambdaSecrets());
    account = await createChatAccount(oystehr, setup.processId, caller.name);
    const sent = DateTime.now().toUTC();
    const message = (text: string, sender: string, minutesAgo: number): Communication =>
      addProcessIdMetaTagToResource(
        buildThreadMessage({
          threadId: account.person.id!,
          kind: 'text',
          text,
          sent: sent.minus({ minutes: minutesAgo }).toISO()!,
          sender: { reference: sender },
          patientId: account.patient.id,
        }),
        setup.processId
      ) as Communication;

    [patientMessage, staffMessage] = await Promise.all([
      oystehr.fhir.create<Communication>(
        message('Can I get a school note?', `RelatedPerson/${account.relatedPerson.id}`, 2)
      ),
      oystehr.fhir.create<Communication>(message('Sure, it is on the way.', setup.testUserM2MProfile, 1)),
    ]);
  }, 60_000);

  afterAll(async () => {
    const created = [staffMessage, patientMessage, account?.person, account?.relatedPerson, account?.patient];
    await oystehr.fhir.transaction({
      requests: created.flatMap((resource) =>
        resource?.id ? [{ method: 'DELETE' as const, url: `${resource.resourceType}/${resource.id}` }] : []
      ),
    });
  });

  it("marks the staff replies in the caller's thread read and leaves the caller's own messages as they were", async () => {
    expect(staffMessage.status).toBe('in-progress');

    const { status, output } = await oystehrZambdas.zambda.execute({ id: 'mark-support-chat-read' });

    expect(status).toBe(200);
    expect(output).toEqual({});
    const [staffAfter, patientAfter] = await Promise.all([
      oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: staffMessage.id! }),
      oystehr.fhir.get<Communication>({ resourceType: 'Communication', id: patientMessage.id! }),
    ]);
    expect(staffAfter.status).toBe('completed');
    expect(patientAfter.status).toBe('in-progress');
  });
});
