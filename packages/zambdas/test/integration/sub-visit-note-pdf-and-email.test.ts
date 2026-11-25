import Oystehr from '@oystehr/sdk';
import { DocumentReference, FhirResource, List, Task } from 'fhir/r4b';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { SaveChartDataResponse } from 'utils/lib/types/api/chart-data/save-chart-data.types';
import { TaskIndicator } from 'utils/lib/types/common';
import { VISIT_DETAILS_CODE, VISIT_NOTE_SUMMARY_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteZ3Object } from '../../src/shared/z3Utils';
import { index } from '../../src/subscriptions/task/sub-visit-note-pdf-and-email/index';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const { emailClient, stripeClient } = vi.hoisted(() => ({
  emailClient: {
    getFeatureFlag: (): boolean => true,
    sendInPersonCompletionEmail: vi.fn(async () => undefined),
    sendVirtualCompletionEmail: vi.fn(async () => undefined),
  },
  stripeClient: {
    paymentIntents: { retrieve: vi.fn(), search: vi.fn(async () => ({ data: [] })) },
    paymentMethods: { retrieve: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
  },
}));

vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/communication')>()),
  getEmailClient: vi.fn(() => emailClient),
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: vi.fn(() => stripeClient),
}));

const deleteTaggedResources = async (
  oystehr: Oystehr,
  processId: string,
  resourceTypes: FhirResource['resourceType'][]
): Promise<void> => {
  for (const resourceType of resourceTypes) {
    const resources = (
      await oystehr.fhir.search<FhirResource>({
        resourceType,
        params: [{ name: '_tag', value: `${INTEGRATION_TEST_PROCESS_ID_SYSTEM}|${processId}` }],
      })
    ).unbundle();
    await Promise.all(
      resources.map((resource) => oystehr.fhir.delete({ resourceType, id: resource.id! }).catch(() => undefined))
    );
  }
};

const readPdfText = async (url: string, token: string): Promise<string> => {
  const data = new Uint8Array(await (await fetch(await getPresignedURL(url, token))).arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join(' ').replace(/\s+/g, ' ');
};

describe('sub-visit-note-pdf-and-email', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let adminToken: string;
  let token: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  let visit: InsertFullAppointmentDataBaseResult;
  let task: Task;
  let chartResources: FhirResource[] = [];
  const chiefComplaint = `Integration visit note cough ${Date.now()}`;

  const encounterDocuments = async (): Promise<DocumentReference[]> =>
    (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'encounter', value: `Encounter/${visit.encounter.id}` }],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-visit-note-pdf-and-email.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    adminToken = setup.token;
    token = setup.testUserM2MToken;
    processId = setup.processId;
    cleanup = setup.cleanup;

    visit = await insertInPersonAppointmentBase(oystehr, processId);
    const saved = await oystehrZambdas.zambda.execute({
      id: 'SAVE-CHART-DATA',
      encounterId: visit.encounter.id,
      chiefComplaint: { text: chiefComplaint },
    });
    chartResources = (saved.output as SaveChartDataResponse).chartResources as FhirResource[];

    task = await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          status: 'ready',
          intent: 'order',
          code: {
            coding: [
              { system: TaskIndicator.visitNotePDFAndEmail.system, code: TaskIndicator.visitNotePDFAndEmail.code },
            ],
          },
          focus: { reference: `Appointment/${visit.appointment.id}` },
          encounter: { reference: `Encounter/${visit.encounter.id}` },
        },
        processId
      ) as Task
    );
  });

  afterAll(async () => {
    const [documents, folders] = await Promise.all([
      encounterDocuments(),
      oystehr.fhir
        .search<List>({ resourceType: 'List', params: [{ name: 'subject', value: `Patient/${visit.patient.id}` }] })
        .then((bundle) => bundle.unbundle()),
    ]);
    await Promise.all(
      documents
        .flatMap((document) => document.content.map((content) => content.attachment.url))
        .filter((url): url is string => !!url && url.includes('/z3/'))
        .map((url) => deleteZ3Object(url, adminToken).catch(() => undefined))
    );
    await Promise.all(
      [...documents, ...folders, ...chartResources].map((resource) =>
        oystehr.fhir.delete({ resourceType: resource.resourceType, id: resource.id! }).catch(() => undefined)
      )
    );
    await cleanup();
    await deleteTaggedResources(oystehr, processId, ['Task', 'Patient']);
  });

  it('stores the signed visit note and visit details PDFs and emails the patient a link to the note', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{
      taskStatus: string;
      statusReason: { text: string };
    }>(index, task, { token });

    expect(statusCode).toBe(200);
    expect(output.taskStatus).toBe('completed');
    expect(output.statusReason.text).toBe('PDF created and emailed successfully');

    const storedTask = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(storedTask.status).toBe('completed');

    const documents = await encounterDocuments();
    const visitNote = documents.find(
      (document) => document.type?.coding?.some((coding) => coding.code === VISIT_NOTE_SUMMARY_CODE)
    );
    const visitDetails = documents.find(
      (document) => document.type?.coding?.some((coding) => coding.code === VISIT_DETAILS_CODE)
    );
    expect(visitNote?.status).toBe('current');
    expect(visitNote?.subject?.reference).toBe(`Patient/${visit.patient.id}`);
    expect(visitNote?.context?.related).toContainEqual({ reference: `Appointment/${visit.appointment.id}` });
    expect(visitDetails?.status).toBe('current');

    const noteText = await readPdfText(visitNote!.content[0].attachment.url!, adminToken);
    expect(noteText).toContain('Snow');
    expect(noteText).toContain(chiefComplaint);

    expect(emailClient.sendVirtualCompletionEmail).toHaveBeenCalledTimes(1);
    expect(emailClient.sendVirtualCompletionEmail).toHaveBeenCalledWith('john.doe@example.com', {
      location: 'Integration Test Location',
      'visit-note-url': expect.stringContaining(visitNote!.content[0].attachment.url!.split('/z3/')[1]),
    });
    expect(emailClient.sendInPersonCompletionEmail).not.toHaveBeenCalled();
  });
});
