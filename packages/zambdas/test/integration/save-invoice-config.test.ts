import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { QuestionnaireResponse } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for save-invoice-config: it writes the project's single invoicing
// config (a QuestionnaireResponse). Read-modify-restore: capture the original
// QuestionnaireResponse, save new values, assert via get-invoice-config, then
// restore the original resource in afterAll.
describe('save-invoice-config integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let originalQR: QuestionnaireResponse | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('save-invoice-config.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const current = await oystehrZambdas.zambda.execute({ id: 'get-invoice-config' });
    originalQR = (current.output as { questionnaireResponse?: QuestionnaireResponse }).questionnaireResponse;
  }, 60_000);

  afterAll(async () => {
    try {
      if (originalQR?.id) {
        await oystehrAdmin.fhir.update<QuestionnaireResponse>(originalQR);
      }
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('saves the invoice config', async () => {
    const memoMarker = `IT-memo-${randomUUID().slice(0, 8)}`;
    await oystehrZambdas.zambda.execute({
      id: 'save-invoice-config',
      dueDaysFromGeneration: 30,
      defaultSmsTemplate: 'Integration test SMS template',
      defaultInvoiceMemo: memoMarker,
    });
    const after = await oystehrZambdas.zambda.execute({ id: 'get-invoice-config' });
    expect(JSON.stringify(after.output)).toContain(memoMarker);
  });
});
