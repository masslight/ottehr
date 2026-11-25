import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SECRETS } from '../data/secrets';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

interface UploadDotVisionDocumentOutput {
  documentRefId: string;
  url: string;
  title: string;
}

describe('upload-dot-vision-document integration', () => {
  let oystehr: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let documentReferenceId: string | undefined;
  const title = `Eye exam referral ${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('upload-dot-vision-document.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    if (documentReferenceId) {
      await oystehr.fhir.delete({ resourceType: 'DocumentReference', id: documentReferenceId }).catch(() => undefined);
    }
    await cleanup();
  });

  it('files the uploaded vision document against the appointment patient and encounter', async () => {
    const z3URL = `${SECRETS.PROJECT_API}/z3/${SECRETS.PROJECT_ID}-${BUCKET_NAMES.VISIT_NOTES}/${
      base.patient.id
    }/${randomUUID()}.pdf`;
    const response = await oystehrZambdas.zambda.execute({
      id: 'upload-dot-vision-document',
      appointmentID: base.appointment.id,
      z3URL,
      title,
    });
    const output = response.output as UploadDotVisionDocumentOutput;
    documentReferenceId = output.documentRefId;

    expect(output).toEqual({ documentRefId: expect.any(String), url: z3URL, title });
    const encounterReference = `Encounter/${base.encounter.id}`;
    const documentReference = await oystehr.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: output.documentRefId,
    });
    expect(documentReference).toMatchObject({
      status: 'current',
      type: { coding: [{ system: 'http://loinc.org', code: '64296-4' }] },
      subject: { reference: `Patient/${base.patient.id}` },
      context: { encounter: [{ reference: encounterReference }], related: [{ reference: encounterReference }] },
      content: [{ attachment: { url: z3URL, title } }],
    });
  });
});
