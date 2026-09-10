import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { PDFDocument } from 'pdf-lib';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { FormTemplateMapping } from 'utils/lib/form-tokens/mapping';
import { addOperation } from 'utils/lib/helpers/operations';
import {
  CreateCompletedFormUploadUrlOutput,
  CreateFormTemplateUploadUrlOutput,
  FillFormTemplateOutput,
  SaveCompletedFormOutput,
} from 'utils/lib/types/api/form-template.types';
import { INTEGRATION_TEST_TAG_SYSTEM } from 'utils/lib/utils/e2eCleanup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

/**
 * The wrong-patient guard on `save-completed-form`.
 *
 * A prefilled form leaves the building — it is printed, signed, scanned, emailed — and comes back by hand.
 * The hazard is that it comes back onto the wrong chart, which is a disclosure rather than a typo, and
 * nothing about the document looks wrong when it happens. The guard compares two things the caller does
 * not control: the patient resolved from the appointment being filed against, and the patient stamped into
 * the PDF when it was produced.
 *
 * Covered here because it is the one behaviour in this feature whose failure is silent: a guard that has
 * stopped comparing accepts everything, and every test that only exercises the happy path still passes.
 */
describe('save-completed-form wrong-patient guard integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  /** Two independent charts: the form is produced for one and offered to the other. */
  let visitA: InsertFullAppointmentDataBaseResult;
  let visitB: InsertFullAppointmentDataBaseResult;

  let templateId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-completed-form-guard.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;

    visitA = await insertInPersonAppointmentBase(setup.oystehr, processId);
    visitB = await insertInPersonAppointmentBase(setup.oystehr, processId);

    // A template with one mapped field, so the produced PDF is a real filled form rather than a copy.
    const created = (
      await oystehrZambdas.zambda.execute({
        id: 'create-form-template-upload-url',
        title: 'Guard test template',
        fileName: 'guard-test.pdf',
      })
    ).output as CreateFormTemplateUploadUrlOutput;
    templateId = created.documentReferenceId;
    await tagForCleanup(templateId);

    const doc = await PDFDocument.create();
    const page = doc.addPage();
    doc.getForm().createTextField('first.name').addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
    const uploaded = await fetch(created.presignedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: (await doc.save()) as unknown as BodyInit,
    });
    expect(uploaded.ok, `template upload failed: ${uploaded.status}`).toBe(true);

    await oystehrZambdas.zambda.execute({ id: 'analyze-form-template', documentReferenceId: templateId });

    const mapping: FormTemplateMapping = {
      version: 1,
      bindings: [{ fieldName: 'first.name', tokenKey: 'patient.firstName' }],
    };
    await oystehrZambdas.zambda.execute({
      id: 'save-form-template-mapping',
      documentReferenceId: templateId,
      mapping,
    });
    await oystehrZambdas.zambda.execute({
      id: 'update-form-template',
      documentReferenceId: templateId,
      published: true,
    });
  }, 120_000);

  afterAll(async () => {
    // Every document this file caused to be written, template and instances alike. The leak gate only
    // sweeps its own run tag, and these were created by zambdas rather than by the test.
    for (const patientId of [visitA?.patient?.id, visitB?.patient?.id]) {
      if (!patientId) continue;
      try {
        const docs = (
          await oystehrAdmin.fhir.search<DocumentReference>({
            resourceType: 'DocumentReference',
            params: [{ name: 'subject', value: `Patient/${patientId}` }],
          })
        ).unbundle();
        await Promise.all(
          docs.map((doc) => oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id: doc.id! }))
        );
      } catch {
        // Best-effort.
      }
    }
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id: templateId });
    } catch {
      // Best-effort.
    }
    await cleanup();
  });

  /**
   * Stamps the cron's cleanup tag onto a document a zambda created.
   *
   * These records are written by the endpoints under test, so the test cannot tag them at creation the
   * way it does its own seed data. Without the tag the nightly sweep cannot see them, and a run that
   * dies before `afterAll` leaves them behind for good. Best-effort: failing to tag is untidy, not a
   * reason to fail the test that just proved the endpoint works.
   */
  const tagForCleanup = async (documentReferenceId: string): Promise<void> => {
    try {
      await oystehrAdmin.fhir.patch<DocumentReference>({
        resourceType: 'DocumentReference',
        id: documentReferenceId,
        operations: [
          addOperation('/meta/tag/-', { system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }),
        ],
      });
    } catch (error) {
      console.warn(`could not tag DocumentReference/${documentReferenceId} for cleanup: ${error}`);
    }
  };

  /** Prefills the template for a visit and returns the produced bytes, stamped as that visit's patient. */
  const produceFilledForm = async (appointmentId: string): Promise<Uint8Array> => {
    const filled = (
      await oystehrZambdas.zambda.execute({
        id: 'fill-form-template',
        documentReferenceId: templateId,
        appointmentId,
      })
    ).output as FillFormTemplateOutput;

    await tagForCleanup(filled.documentReferenceId);

    const download = await fetch(filled.presignedUrl);
    expect(download.ok, `could not download the filled form: ${download.status}`).toBe(true);
    return new Uint8Array(await download.arrayBuffer());
  };

  /** Uploads bytes as a completed form for a visit and files them, returning the verdict and where they went. */
  const returnForm = async (
    appointmentId: string,
    bytes: Uint8Array
  ): Promise<{ result: SaveCompletedFormOutput; z3Url: string }> => {
    const upload = (
      await oystehrZambdas.zambda.execute({
        id: 'create-completed-form-upload-url',
        appointmentId,
        fileName: 'completed.pdf',
      })
    ).output as CreateCompletedFormUploadUrlOutput;

    const put = await fetch(upload.presignedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: bytes as unknown as BodyInit,
    });
    expect(put.ok, `completed-form upload failed: ${put.status}`).toBe(true);

    const result = (
      await oystehrZambdas.zambda.execute({
        id: 'save-completed-form',
        appointmentId,
        z3Url: upload.z3Url,
      })
    ).output as SaveCompletedFormOutput;

    if (result.documentReferenceId) await tagForCleanup(result.documentReferenceId);

    return { result, z3Url: upload.z3Url };
  };

  const documentsFor = async (patientId: string): Promise<DocumentReference[]> =>
    (
      await oystehrAdmin.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'subject', value: `Patient/${patientId}` }],
      })
    ).unbundle();

  it('refuses a form stamped for another patient, and writes nothing to the chart it was offered to', async () => {
    const stampedForA = await produceFilledForm(visitA.appointment.id!);
    const { result, z3Url } = await returnForm(visitB.appointment.id!, stampedForA);

    expect(result.status).toBe('patientMismatch');
    // Names the chart it actually belongs to, which is what makes the refusal actionable.
    expect(result.stampedPatientId).toBe(visitA.patient.id);
    // The refusal is a precondition of the record existing, not something undone afterwards.
    expect(result.documentReferenceId).toBeUndefined();

    // Checked by what a document would have pointed at rather than by counting this patient's documents.
    // A count would depend on every other write to this chart having been indexed first; asking whether
    // anything references these particular bytes cannot be answered wrongly by a stale index, because the
    // answer is about something that was never written.
    const documents = await documentsFor(visitB.patient.id!);
    expect(
      documents.some((doc) => doc.content?.some((entry) => entry.attachment?.url === z3Url)),
      'a refused upload must leave no document behind'
    ).toBe(false);
  });

  it('accepts the same form on the chart it was produced for', async () => {
    const stampedForA = await produceFilledForm(visitA.appointment.id!);
    const { result } = await returnForm(visitA.appointment.id!, stampedForA);

    expect(result.status).toBe('verified');
    expect(result.documentReferenceId).toBeTruthy();
    // Filed against the form it came from, which is how the chart shows the form as returned.
    expect(result.filedUnderTemplateId).toBe(templateId);

    const filed = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: result.documentReferenceId!,
    });
    expect(filed.subject?.reference).toBe(`Patient/${visitA.patient.id}`);
    // The provider has finished with it, unlike the prefilled draft it came from.
    expect(filed.docStatus).toBe('final');
  });

  it('accepts a document carrying no stamp at all, rather than making the guard a ban on uploading', async () => {
    // Most documents that legitimately reach a chart were never produced by this system — a scan, a fax,
    // a photograph of a signed page. Refusing them would turn a check on documents that claim an origin
    // into a blanket restriction. `templateId` says what it is, since nothing in the file does.
    const plain = await PDFDocument.create();
    plain.addPage();
    const bytes = await plain.save();

    const upload = (
      await oystehrZambdas.zambda.execute({
        id: 'create-completed-form-upload-url',
        appointmentId: visitB.appointment.id,
        fileName: 'scanned.pdf',
      })
    ).output as CreateCompletedFormUploadUrlOutput;

    const put = await fetch(upload.presignedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: bytes as unknown as BodyInit,
    });
    expect(put.ok).toBe(true);

    const result = (
      await oystehrZambdas.zambda.execute({
        id: 'save-completed-form',
        appointmentId: visitB.appointment.id,
        z3Url: upload.z3Url,
        templateId,
      })
    ).output as SaveCompletedFormOutput;

    expect(result.status).toBe('unstamped');
    expect(result.documentReferenceId).toBeTruthy();
  });

  it('reports needsSource when nothing says what an unstamped document is', async () => {
    const plain = await PDFDocument.create();
    plain.addPage();

    const upload = (
      await oystehrZambdas.zambda.execute({
        id: 'create-completed-form-upload-url',
        appointmentId: visitB.appointment.id,
        fileName: 'mystery.pdf',
      })
    ).output as CreateCompletedFormUploadUrlOutput;

    await fetch(upload.presignedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: (await plain.save()) as unknown as BodyInit,
    });

    // No stamp and no templateId: filing it unattributed would lose the connection to the form it
    // belongs to, so the caller is asked rather than guessed for.
    const result = (
      await oystehrZambdas.zambda.execute({
        id: 'save-completed-form',
        appointmentId: visitB.appointment.id,
        z3Url: upload.z3Url,
      })
    ).output as SaveCompletedFormOutput;

    expect(result.status).toBe('needsSource');
    expect(result.documentReferenceId).toBeUndefined();

    // Nothing was written, so the bytes are still parked waiting to be identified — which is the design,
    // and which nothing else would clean up. Discarding them is also the only way this path gets covered.
    const discarded = (
      await oystehrZambdas.zambda.execute({
        id: 'save-completed-form',
        appointmentId: visitB.appointment.id,
        z3Url: upload.z3Url,
        discard: true,
      })
    ).output as SaveCompletedFormOutput;

    expect(discarded.status).toBe('discarded');
  });
});
