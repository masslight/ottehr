import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, FhirResource, List, Organization, Practitioner, Task } from 'fhir/r4b';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES, FOLDERS_CONFIG } from 'utils/lib/fhir/constants';
import { createPatientDocumentList } from 'utils/lib/fhir/list';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { SecretsKeys } from 'utils/lib/secrets';
import {
  DOCUMENT_PACKET_REQUEST_TASK_INPUT,
  DOCUMENT_PACKET_RESULTS_TASK_OUTPUT,
  DocumentPacketRecipientResult,
  DocumentPacketTaskPayload,
} from 'utils/lib/types/api/document-packet.types';
import { TaskIndicator } from 'utils/lib/types/common';
import { FAX_PACKET_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SendLetterFaxInput } from '../../src/shared/send-letter-fax';
import { createPresignedUrl, deleteZ3Object } from '../../src/shared/z3Utils';
import { index } from '../../src/subscriptions/task/sub-send-document-packet/index';
import { SECRETS } from '../data/secrets';
import { INTEGRATION_TEST_PROCESS_ID_SYSTEM } from '../helpers/integration-tags';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../helpers/invoke-zambda-handler';

const { sendLetterFaxMock } = vi.hoisted(() => ({
  sendLetterFaxMock: vi.fn(async (_input: SendLetterFaxInput) => ({
    resourceType: 'Communication',
    id: crypto.randomUUID(),
    status: 'completed',
  })),
}));

vi.mock('../../src/shared/send-letter-fax', () => ({ sendLetterFax: sendLetterFaxMock }));

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

const readPdfText = async (url: string, token: string): Promise<{ pageCount: number; text: string }> => {
  const data = new Uint8Array(await (await fetch(await getPresignedURL(url, token))).arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return { pageCount: pdf.numPages, text: pages.join(' ').replace(/\s+/g, ' ') };
};

const onePagePdf = async (text: string): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText(text, { x: 50, y: 700, size: 14, font });
  return pdf.save();
};

describe('sub-send-document-packet', () => {
  let oystehr: Oystehr;
  let adminToken: string;
  let token: string;
  let processId: string;
  let cleanup: () => Promise<void>;
  let visit: InsertFullAppointmentDataBaseResult;
  let faxesFolder: List;
  let sourceDocument: DocumentReference;
  let task: Task;
  let organization: Organization;
  let sender: Practitioner;
  const suffix = randomUUID().slice(0, 8);
  const sourceText = `Integration packet source ${suffix}`;
  const recipients = [
    { name: `Alice Packet ${suffix}`, organization: 'First Clinic', faxNumber: '+15555550101' },
    { name: `Bob Packet ${suffix}`, organization: 'Second Clinic', faxNumber: '+15555550102' },
  ];

  const patientFolders = async (): Promise<List[]> =>
    (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'subject', value: `Patient/${visit.patient.id}` }],
      })
    ).unbundle();

  const patientPackets = async (): Promise<DocumentReference[]> =>
    (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'subject', value: `Patient/${visit.patient.id}` },
          { name: 'type', value: `http://loinc.org|${FAX_PACKET_CODE}` },
        ],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-send-document-packet.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    adminToken = setup.token;
    token = setup.testUserM2MToken;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const organizationId = loadZambdaSecrets()[SecretsKeys.ORGANIZATION_ID];
    const senderId = setup.testUserM2MProfile.replace('Practitioner/', '');
    [organization, sender, visit] = await Promise.all([
      oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId }),
      oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: senderId }),
      insertInPersonAppointmentBase(oystehr, processId),
    ]);

    const sourceUrl = `${SECRETS.PROJECT_API}/z3/${SECRETS.PROJECT_ID}-${BUCKET_NAMES.FAXES}/${visit.patient.id}/${suffix}-source.pdf`;
    const uploadResponse = await fetch(await createPresignedUrl(adminToken, sourceUrl, 'upload'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: await onePagePdf(sourceText),
    });
    expect(uploadResponse.ok).toBe(true);

    const faxesConfig = FOLDERS_CONFIG.find((config) => config.documentTypeCode === FAX_PACKET_CODE)!;
    [faxesFolder, sourceDocument] = await Promise.all([
      oystehr.fhir.create<List>(
        addProcessIdMetaTagToResource(
          createPatientDocumentList(`Patient/${visit.patient.id}`, faxesConfig),
          processId
        ) as List
      ),
      oystehr.fhir.create<DocumentReference>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'DocumentReference',
            status: 'current',
            subject: { reference: `Patient/${visit.patient.id}` },
            date: new Date().toISOString(),
            context: { related: [{ reference: `Appointment/${visit.appointment.id}` }] },
            content: [{ attachment: { url: sourceUrl, contentType: 'application/pdf', title: 'Referral letter' } }],
          },
          processId
        ) as DocumentReference
      ),
    ]);

    const payload: DocumentPacketTaskPayload = {
      source: { type: 'document', patientId: visit.patient.id!, documentReferenceId: sourceDocument.id! },
      recipients,
      senderPractitionerId: sender.id!,
      senderUserId: randomUUID(),
    };
    task = await oystehr.fhir.create<Task>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Task',
          status: 'ready',
          intent: 'order',
          code: {
            coding: [{ system: TaskIndicator.sendDocumentPacket.system, code: TaskIndicator.sendDocumentPacket.code }],
          },
          focus: { reference: `Appointment/${visit.appointment.id}` },
          for: { reference: `Patient/${visit.patient.id}` },
          input: [{ type: { coding: [DOCUMENT_PACKET_REQUEST_TASK_INPUT] }, valueString: JSON.stringify(payload) }],
        },
        processId
      ) as Task
    );
  });

  afterAll(async () => {
    const [packets, folders, attempts] = await Promise.all([
      patientPackets(),
      patientFolders(),
      oystehr.fhir
        .search<Task>({ resourceType: 'Task', params: [{ name: 'patient', value: `Patient/${visit.patient.id}` }] })
        .then((bundle) => bundle.unbundle()),
    ]);
    await Promise.all(
      [...packets, sourceDocument]
        .map((document) => document.content[0].attachment.url!)
        .map((url) => deleteZ3Object(url, adminToken).catch(() => undefined))
    );
    await Promise.all(
      [...packets, ...folders, ...attempts].map((resource) =>
        oystehr.fhir.delete({ resourceType: resource.resourceType, id: resource.id! }).catch(() => undefined)
      )
    );
    await cleanup();
    await deleteTaggedResources(oystehr, processId, ['Task', 'DocumentReference', 'List', 'Patient']);
  });

  it('faxes a separate packet to each of two recipients and files both packets in the Faxes folder', async () => {
    const { statusCode, output } = await invokeZambdaHandler<{ taskStatus: string; statusReason: string }>(
      index,
      task,
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({ taskStatus: 'completed', statusReason: 'document packet sent to 2/2 recipient(s)' });

    const storedTask = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: task.id! });
    expect(storedTask.status).toBe('completed');
    const results = JSON.parse(
      storedTask.output!.find(
        (entry) => entry.type.coding?.some((coding) => coding.code === DOCUMENT_PACKET_RESULTS_TASK_OUTPUT.code)
      )!.valueString!
    ) as DocumentPacketRecipientResult[];
    expect(results).toEqual(recipients.map((recipient) => ({ ...recipient, status: 'sent' })));

    const packets = await patientPackets();
    expect(packets).toHaveLength(2);
    packets.forEach((packet) => {
      expect(packet.status).toBe('current');
      expect(packet.context?.related).toContainEqual({ reference: `Appointment/${visit.appointment.id}` });
      expect(packet.context?.encounter).toContainEqual({ reference: `Encounter/${visit.encounter.id}` });
    });

    expect(sendLetterFaxMock).toHaveBeenCalledTimes(2);
    const faxedTo = sendLetterFaxMock.mock.calls.map(([input]) => input);
    expect(faxedTo.map((input) => input.faxNumber)).toEqual(recipients.map((recipient) => recipient.faxNumber));
    expect(faxedTo.map((input) => input.patientId)).toEqual([visit.patient.id, visit.patient.id]);
    expect(faxedTo.map((input) => input.organizationId)).toEqual([organization.id, organization.id]);
    expect(new Set(faxedTo.map((input) => input.media))).toEqual(
      new Set(packets.map((packet) => packet.content[0].attachment.url))
    );

    for (const [position, recipient] of recipients.entries()) {
      const packetUrl = faxedTo[position].media;
      const { pageCount, text } = await readPdfText(packetUrl, adminToken);
      expect(pageCount).toBe(2);
      expect(text).toContain(recipient.name);
      expect(text).toContain(recipient.organization);
      expect(text).toContain(sourceText);
      expect(text).toContain('Snow');
      expect(text).toContain(organization.name!);
      expect(text).toContain(getFullestAvailableName(sender)!);
    }

    const folders = (await patientFolders()).filter((folder) => folder.title === BUCKET_NAMES.FAXES);
    expect(folders.map((folder) => folder.id)).toEqual([faxesFolder.id]);
    expect(folders[0].entry?.map((entry) => entry.item.reference).sort()).toEqual(
      packets.map((packet) => `DocumentReference/${packet.id}`).sort()
    );
  });
});
