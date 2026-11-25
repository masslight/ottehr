import Oystehr, { FhirResourceReturnValue, SearchParam } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Communication, DocumentReference, FhirResource, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { STATEMENT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/statements/get-status/index';
import { MAIL_VENDOR_EXTENSION_URL, PostGridLetter } from '../../src/shared/postgrid';
import { SECRETS } from '../data/secrets';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const { getPostGridLetter } = vi.hoisted(() => ({ getPostGridLetter: vi.fn() }));

vi.mock('../../src/shared/postgrid', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/postgrid')>()),
  getPostGridLetter,
}));

describe('get-statement-status integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let processId: string;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;
  const created: FhirResource[] = [];

  const createTagged = async <T extends FhirResource>(resource: T): Promise<FhirResourceReturnValue<T>> => {
    const result = await oystehr.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    created.push(result);
    return result;
  };

  const waitUntilSearchable = async (resource: FhirResource, params: SearchParam[]): Promise<void> => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const found = (await oystehr.fhir.search({ resourceType: resource.resourceType, params })).unbundle();
      if (found.some((candidate) => candidate.id === resource.id)) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`${resource.resourceType}/${resource.id} never became searchable`);
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-statement-status.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    processId = setup.processId;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    for (const resource of created) {
      await oystehr.fhir.delete({ resourceType: resource.resourceType, id: resource.id! }).catch(() => undefined);
    }
    await cleanup();
  });

  it('reports the statement PDF, the mailed letter with its PostGrid status, and the email task for the visit', async () => {
    const encounterReference = `Encounter/${base.encounter.id}`;
    const patientReference = `Patient/${base.patient.id}`;
    const letterId = `letter_${randomUUID()}`;

    const [statementDocRef, mailCommunication, emailTask] = await Promise.all([
      createTagged<DocumentReference>({
        resourceType: 'DocumentReference',
        status: 'current',
        type: { coding: [{ system: 'http://loinc.org', code: STATEMENT_CODE, display: 'Statement' }] },
        subject: { reference: patientReference },
        date: '2026-11-19T15:00:00.000Z',
        context: { encounter: [{ reference: encounterReference }] },
        content: [
          {
            attachment: {
              url: `${SECRETS.PROJECT_API}/z3/${SECRETS.PROJECT_ID}-statements/${
                base.patient.id
              }/${randomUUID()}-statement.pdf`,
              contentType: 'application/pdf',
              title: 'statement.pdf',
            },
          },
        ],
      }),
      createTagged<Communication>({
        resourceType: 'Communication',
        status: 'completed',
        subject: { reference: patientReference },
        encounter: { reference: encounterReference },
        sent: '2026-11-20T15:00:00.000Z',
        medium: [
          { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode', code: 'MAILWRIT' }] },
        ],
        payload: [{ contentString: 'Patient statement mailed' }],
        extension: [
          { url: MAIL_VENDOR_EXTENSION_URL, extension: [{ url: 'vendor-letter-id', valueString: letterId }] },
        ],
      }),
      createTagged<Task>({
        resourceType: 'Task',
        status: 'completed',
        intent: 'order',
        code: { coding: [{ code: 'send-statement-by-email' }] },
        for: { reference: patientReference },
        encounter: { reference: encounterReference },
        authoredOn: '2026-11-21T15:00:00.000Z',
      }),
    ]);
    await Promise.all([
      waitUntilSearchable(statementDocRef, [
        { name: 'encounter', value: encounterReference },
        { name: 'type', value: STATEMENT_CODE },
      ]),
      waitUntilSearchable(mailCommunication, [{ name: 'encounter', value: encounterReference }]),
      waitUntilSearchable(emailTask, [
        { name: 'encounter', value: encounterReference },
        { name: 'code', value: '|send-statement-by-email' },
      ]),
    ]);

    const letter: Partial<PostGridLetter> = {
      id: letterId,
      status: 'processed_for_delivery',
      sendDate: '2026-11-22T00:00:00.000Z',
      url: `https://postgrid.example/letters/${letterId}.pdf`,
    };
    getPostGridLetter.mockResolvedValueOnce(letter);

    const { statusCode, output } = await invokeZambdaHandler(index, { encounterId: base.encounter.id }, { token });

    expect(statusCode).toBe(200);
    expect(getPostGridLetter).toHaveBeenCalledWith(
      letterId,
      expect.objectContaining({ PROJECT_ID: SECRETS.PROJECT_ID })
    );
    expect(output).toEqual({
      encounterId: base.encounter.id,
      generated: {
        generated: true,
        lastGenerated: statementDocRef.date,
        url: statementDocRef.content[0].attachment.url,
      },
      communication: {
        found: true,
        id: mailCommunication.id,
        status: 'completed',
        sent: mailCommunication.sent,
      },
      sendStatementByEmailTask: {
        found: true,
        id: emailTask.id,
        status: 'completed',
        authoredOn: emailTask.authoredOn,
      },
      mailProcessor: {
        found: true,
        letterId,
        source: 'communication',
        status: letter.status,
        sendDate: letter.sendDate,
        url: letter.url,
      },
    });
  }, 120_000);
});
