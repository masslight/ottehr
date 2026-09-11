import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { PDFDocument } from 'pdf-lib';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { FormTemplateMapping } from 'utils/lib/form-tokens/mapping';
import { addOperation } from 'utils/lib/helpers/operations';
import {
  AnalyzeFormTemplateOutput,
  CreateFormTemplateUploadUrlOutput,
  GetFormTemplateDetailOutput,
  ListFormTemplatesOutput,
} from 'utils/lib/types/api/form-template.types';
import { INTEGRATION_TEST_TAG_SYSTEM } from 'utils/lib/utils/e2eCleanup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

/**
 * The form-template endpoints, end to end: presign, upload, analyse, publish, map, replace, delete.
 *
 * The point of covering this as a sequence rather than per endpoint is that each step's input is the
 * previous step's output, and the record is written before the bytes exist — so the interesting failures
 * are ordering failures, which no single-endpoint test can reach.
 *
 * Templates are project-level rather than patient-scoped, so nothing here needs an appointment graph, and
 * cleanup is by the ids this file created.
 */
describe('form template lifecycle integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  /** Every template this file creates, removed in afterAll — the leak gate only sweeps its own run tag. */
  const createdTemplateIds: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('form-template-lifecycle.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    processId = setup.processId;
  }, 60_000);

  afterAll(async () => {
    for (const id of createdTemplateIds) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: 'DocumentReference', id });
      } catch {
        // Already deleted by the test that created it, which is the expected case for most of them.
      }
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

  /** A real AcroForm, built rather than committed as a fixture so what it contains is visible here. */
  const acroFormPdf = async (): Promise<Uint8Array> => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const field = doc.getForm().createTextField('patient.name.first');
    field.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
    return doc.save();
  };

  const putPdf = async (presignedUploadUrl: string, bytes: Uint8Array): Promise<void> => {
    const response = await fetch(presignedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: bytes as unknown as BodyInit,
    });
    expect(response.ok, `PUT to the presigned URL failed: ${response.status} ${response.statusText}`).toBe(true);
  };

  const presign = async (params: Record<string, unknown>): Promise<CreateFormTemplateUploadUrlOutput> =>
    (await oystehrZambdas.zambda.execute({ id: 'create-form-template-upload-url', ...params }))
      .output as CreateFormTemplateUploadUrlOutput;

  /**
   * Whether the listing has stopped including a template, allowing for the search index to catch up.
   *
   * The listing is search-backed and FHIR search is eventually consistent, so a single read straight
   * after the delete can still return the old row. Polled rather than asserted once — a bare assertion
   * here would fail intermittently, and `retry: 2` on this project would hide it most of the time.
   */
  const listingOmits = async (documentReferenceId: string): Promise<boolean> => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const listed = (await oystehrZambdas.zambda.execute({ id: 'list-form-templates', includeUnpublished: true }))
        .output as ListFormTemplatesOutput;
      if (!listed.items.some((item) => item.documentReferenceId === documentReferenceId)) return true;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  };

  it('presigns, uploads, analyses, publishes, maps and deletes a template', async () => {
    // --- presign: the record exists as a draft before any bytes do
    const created = await presign({ title: 'Integration test template', fileName: 'integration-test.pdf' });

    expect(created.documentReferenceId).toBeTruthy();
    // A name, not an address — the bucket is the server's to choose and is not expressible here.
    expect(created.objectName).not.toContain('/');
    expect(created.presignedUploadUrl).toBeTruthy();
    createdTemplateIds.push(created.documentReferenceId);
    await tagForCleanup(created.documentReferenceId);

    const listedAsDraft = (await oystehrZambdas.zambda.execute({ id: 'list-form-templates', includeUnpublished: true }))
      .output as ListFormTemplatesOutput;
    const draft = listedAsDraft.items.find((item) => item.documentReferenceId === created.documentReferenceId);
    expect(draft, 'the new template should appear in the unpublished listing').toBeDefined();
    expect(draft?.published).toBe(false);

    // --- upload, then analyse: the first step that reads the stored bytes
    await putPdf(created.presignedUploadUrl, await acroFormPdf());

    const analysis = (
      await oystehrZambdas.zambda.execute({
        id: 'analyze-form-template',
        documentReferenceId: created.documentReferenceId,
      })
    ).output as AnalyzeFormTemplateOutput & { status: string; fields: { name: string }[] };

    expect(analysis.status).toBe('fillable');
    expect(analysis.fields.map((field) => field.name)).toContain('patient.name.first');

    // --- publish: the chart-facing listing is a separate result set from the admin one
    await oystehrZambdas.zambda.execute({
      id: 'update-form-template',
      documentReferenceId: created.documentReferenceId,
      published: true,
    });

    const listedPublished = (await oystehrZambdas.zambda.execute({ id: 'list-form-templates' }))
      .output as ListFormTemplatesOutput;
    expect(
      listedPublished.items.some((item) => item.documentReferenceId === created.documentReferenceId),
      'a published template should appear without includeUnpublished'
    ).toBe(true);

    // --- map: saved, then read back through the detail endpoint
    const mapping: FormTemplateMapping = {
      version: 1,
      bindings: [{ fieldName: 'patient.name.first', tokenKey: 'patient.firstName' }],
    };

    await oystehrZambdas.zambda.execute({
      id: 'save-form-template-mapping',
      documentReferenceId: created.documentReferenceId,
      mapping,
    });

    const detail = (
      await oystehrZambdas.zambda.execute({
        id: 'get-form-template-detail',
        documentReferenceId: created.documentReferenceId,
      })
    ).output as GetFormTemplateDetailOutput;

    expect(detail.item.published).toBe(true);
    expect(detail.item.fillable).toBe(true);
    expect(detail.fields.map((field) => field.name)).toContain('patient.name.first');
    expect(detail.mapping).toEqual(mapping);

    // --- delete: soft, so the record survives with `status` marking it gone
    await oystehrZambdas.zambda.execute({
      id: 'delete-form-template',
      documentReferenceId: created.documentReferenceId,
    });

    // Read by id, which is strongly consistent, rather than inferring the write from the listing.
    const afterDelete = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: created.documentReferenceId,
    });
    expect(afterDelete.status).toBe('superseded');

    expect(await listingOmits(created.documentReferenceId), 'a deleted template should stop being listed').toBe(true);
  });

  it('hands back a candidate location when replacing, and changes nothing', async () => {
    const created = await presign({ title: 'Replacement subject', fileName: 'original.pdf' });
    createdTemplateIds.push(created.documentReferenceId);
    await tagForCleanup(created.documentReferenceId);
    await putPdf(created.presignedUploadUrl, await acroFormPdf());

    const replacement = await presign({
      documentReferenceId: created.documentReferenceId,
      fileName: 'replacement.pdf',
    });

    // The same record, and a different place to put the candidate bytes.
    expect(replacement.documentReferenceId).toBe(created.documentReferenceId);
    expect(replacement.objectName).not.toBe(created.objectName);

    // Read the record itself rather than counting the listing: the contract is that this template still
    // points at its working file until `replace-form-template-pdf` has analysed the candidate, and a
    // count would only ever be a proxy for that — one that another test file creating a template
    // concurrently could break.
    const stored = await oystehrAdmin.fhir.get<DocumentReference>({
      resourceType: 'DocumentReference',
      id: created.documentReferenceId,
    });
    // Compared by name, since the address is the server's and the test only ever sees the name.
    expect(stored.content?.[0]?.attachment?.url).toContain(created.objectName);
    expect(stored.content?.[0]?.attachment?.url).not.toContain(replacement.objectName);
    expect(stored.docStatus).toBe('preliminary');
  });

  describe('input shape', () => {
    const expectRejection = async (params: Record<string, unknown>, what: string): Promise<void> => {
      let caught: unknown;
      try {
        await oystehrZambdas.zambda.execute({ id: 'create-form-template-upload-url', ...params });
      } catch (error) {
        caught = error;
      }
      expect(caught, `expected ${what} to be rejected`).toBeDefined();
    };

    // The reason the input is a union of two shapes rather than one with optional halves: a payload
    // carrying both must not match the create branch and quietly mint a second template.
    it('refuses a payload naming both a template to replace and a title', async () => {
      await expectRejection(
        { documentReferenceId: 'some-id', title: 'Both at once', fileName: 'x.pdf' },
        'documentReferenceId together with title'
      );
    });

    it('refuses a payload that neither names a template nor supplies a title', async () => {
      await expectRejection({ fileName: 'x.pdf' }, 'a payload with neither');
    });
  });
});
