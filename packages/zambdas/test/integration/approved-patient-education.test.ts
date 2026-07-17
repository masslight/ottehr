import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path chain for the approved-patient-education endpoints: save an approved
// education entry, update its ICD codes, then delete it. Uses a unique fake ICD
// code so it never replaces a real instance entry. FHIR + Oystehr z3 only.
describe('approved-patient-education integration — happy path', () => {
  let oystehrProvider: Oystehr;
  let documentReferenceId: string | undefined;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('approved-patient-education.test.ts', M2MClientMockType.provider);
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    if (documentReferenceId) {
      await oystehrProvider.zambda
        .execute({ id: 'delete-approved-patient-education', documentReferenceId })
        .catch(() => undefined);
    }
    await cleanup();
  });

  it('saves, updates the codes of, and deletes an approved education entry', async () => {
    const code = `IT-${randomUUID().slice(0, 8)}`;
    const pdfBase64 = Buffer.from('%PDF-1.4\nintegration test\n%%EOF').toString('base64');

    const saveResponse = await oystehrProvider.zambda.execute({
      id: 'save-approved-patient-education',
      pdfBase64,
      title: 'Integration Test Education',
      icdCodes: [{ code, display: 'Integration Test Condition' }],
    });
    documentReferenceId = (saveResponse.output as { documentReferenceId: string }).documentReferenceId;
    expect(documentReferenceId).toBeDefined();

    const updateResponse = await oystehrProvider.zambda.execute({
      id: 'update-approved-patient-education-codes',
      documentReferenceId,
      icdCodes: [{ code: `${code}-b`, display: 'Integration Test Condition B' }],
    });
    expect(updateResponse.output).toBeDefined();

    const deleteResponse = await oystehrProvider.zambda.execute({
      id: 'delete-approved-patient-education',
      documentReferenceId,
    });
    expect(deleteResponse.output).toBeDefined();
    documentReferenceId = undefined; // already deleted
  });
});
