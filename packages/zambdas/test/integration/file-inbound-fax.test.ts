import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Communication, DocumentReference, List, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { FAX_TASK, getTaskInputValue, isInboundFaxFiled } from 'utils/lib/types/data/tasks/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTask } from '../../src/shared/tasks';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

interface FileInboundFaxOutput {
  documentRefId: string;
  folderId: string;
}

describe('file-inbound-fax integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;
  let providerProfile: string;
  let base: InsertFullAppointmentDataBaseResult;
  let communication: Communication;
  let folder: List;
  let faxTask: Task;
  const pdfUrl = `https://project-api.zapehr.com/v1/z3/integration-test-faxes/${randomUUID()}.pdf`;
  const receivedDate = new Date().toISOString();
  const createdResources: { resourceType: 'DocumentReference' | 'Task'; id: string }[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('file-inbound-fax.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
    providerProfile = setup.testUserM2MProfile;
    base = await insertInPersonAppointmentBase(setup.oystehr, processId);

    communication = await oystehrAdmin.fhir.create<Communication>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Communication',
          status: 'in-progress',
          subject: { reference: `Patient/${base.patient.id}` },
          payload: [{ contentString: 'Integration test inbound fax' }],
        },
        processId
      ) as Communication
    );

    folder = await oystehrAdmin.fhir.create<List>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'List',
          status: 'current',
          mode: 'working',
          title: `Integration fax folder ${randomUUID().slice(0, 8)}`,
          subject: { reference: `Patient/${base.patient.id}` },
        },
        processId
      ) as List
    );

    faxTask = await oystehrAdmin.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        createTask({
          category: FAX_TASK.category,
          title: 'Match inbound fax',
          code: { system: FAX_TASK.system, code: FAX_TASK.code.matchInboundFax },
          basedOn: [`Communication/${communication.id}`],
          input: [
            { type: FAX_TASK.input.pdfUrl, valueString: pdfUrl },
            { type: FAX_TASK.input.communicationId, valueString: communication.id },
            { type: FAX_TASK.input.receivedDate, valueString: receivedDate },
          ],
        }),
        processId
      ) as Task
    );
  }, 60_000);

  afterAll(async () => {
    const toDelete = [
      ...createdResources,
      ...(faxTask?.id ? [{ resourceType: 'Task' as const, id: faxTask.id }] : []),
      ...(folder?.id ? [{ resourceType: 'List' as const, id: folder.id }] : []),
      ...(communication?.id ? [{ resourceType: 'Communication' as const, id: communication.id }] : []),
    ];
    for (const { resourceType, id } of toDelete) {
      await oystehrAdmin.fhir.delete({ resourceType, id }).catch((error) => console.warn(error));
    }
    await cleanup();
  });

  it('files the fax into the patient folder on the visit and creates the review task', async () => {
    const documentName = `Faxed labs ${randomUUID().slice(0, 8)}`;
    const assigneeId = getIdFromReference(providerProfile, 'Practitioner')!;

    const { output } = await oystehrZambdas.zambda.execute({
      id: 'file-inbound-fax',
      taskId: faxTask.id,
      communicationId: communication.id,
      patientId: base.patient.id,
      folderId: folder.id,
      documentName,
      encounterId: base.encounter.id,
      reviewTaskAssignee: { id: assigneeId, name: 'Integration Reviewer' },
    });
    const { documentRefId, folderId } = output as FileInboundFaxOutput;
    expect(folderId).toBe(folder.id);
    createdResources.push({ resourceType: 'DocumentReference', id: documentRefId });

    const reviewTasks = (
      await oystehrAdmin.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: 'focus', value: `DocumentReference/${documentRefId}` },
          { name: 'code', value: `${FAX_TASK.system}|${FAX_TASK.code.reviewInboundFax}` },
        ],
      })
    ).unbundle();
    reviewTasks.forEach((task) => createdResources.push({ resourceType: 'Task', id: task.id! }));

    const [document, updatedFolder, updatedFaxTask] = await Promise.all([
      oystehrAdmin.fhir.get<DocumentReference>({ resourceType: 'DocumentReference', id: documentRefId }),
      oystehrAdmin.fhir.get<List>({ resourceType: 'List', id: folder.id! }),
      oystehrAdmin.fhir.get<Task>({ resourceType: 'Task', id: faxTask.id! }),
    ]);

    expect(document.subject?.reference).toBe(`Patient/${base.patient.id}`);
    expect(document.description).toBe(documentName);
    expect(document.context?.encounter).toEqual([{ reference: `Encounter/${base.encounter.id}` }]);
    expect(document.content?.[0]?.attachment).toMatchObject({
      url: pdfUrl,
      contentType: 'application/pdf',
      title: documentName,
    });

    expect(updatedFolder.entry?.map((entry) => entry.item.reference)).toEqual([`DocumentReference/${documentRefId}`]);

    expect(isInboundFaxFiled(updatedFaxTask)).toBe(true);
    expect(updatedFaxTask.status).toBe(faxTask.status);

    expect(reviewTasks).toHaveLength(1);
    const [reviewTask] = reviewTasks;
    expect(reviewTask.status).toBe('in-progress');
    expect(reviewTask.description).toBe(`Review fax “${documentName}” for Jon Snow`);
    expect(reviewTask.encounter?.reference).toBe(`Encounter/${base.encounter.id}`);
    expect(reviewTask.owner).toMatchObject({
      reference: `Practitioner/${assigneeId}`,
      display: 'Integration Reviewer',
    });
    expect(reviewTask.requester?.reference).toBe(providerProfile);
    expect(getTaskInputValue(reviewTask, FAX_TASK.input.patientId)).toBe(base.patient.id);
    expect(getTaskInputValue(reviewTask, FAX_TASK.input.folderId)).toBe(folder.id);
    expect(getTaskInputValue(reviewTask, FAX_TASK.input.appointmentId)).toBe(base.appointment.id);
    expect(getTaskInputValue(reviewTask, FAX_TASK.input.communicationId)).toBe(communication.id);
    expect(getTaskInputValue(reviewTask, FAX_TASK.input.receivedDate)).toBe(receivedDate);
  });
});
