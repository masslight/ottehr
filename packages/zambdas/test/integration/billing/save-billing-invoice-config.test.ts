import { randomUUID } from 'node:crypto';
import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ParsedInvoiceConfig, parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import { InvoiceConfigResponse, SaveInvoiceConfigInput } from 'utils/lib/types/api/invoice-config.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('save-billing-invoice-config', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;
  let previous: ParsedInvoiceConfig | undefined;

  const save = async (input: SaveInvoiceConfigInput): Promise<InvoiceConfigResponse> =>
    (await oystehr.zambda.execute({ id: 'save-billing-invoice-config', ...input }))
      .output as unknown as InvoiceConfigResponse;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/save-billing-invoice-config.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = setup.oystehrBilling;
    cleanup = setup.cleanup;
  }, 120_000);

  afterAll(async () => {
    try {
      if (previous) await save(previous);
    } catch (error) {
      console.error('Failed to restore the invoicing config:', error);
    }
    await cleanup();
  }, 120_000);

  it('saves the templates on the invoicing config response and keeps the other settings', async () => {
    const current = (await oystehr.zambda.execute({ id: 'get-billing-invoice-config' }))
      .output as unknown as InvoiceConfigResponse;
    previous = parseInvoiceConfigFromQR(current.questionnaireResponse);
    const marker = randomUUID();
    const values: SaveInvoiceConfigInput = {
      dueDaysFromGeneration: previous.dueDaysFromGeneration,
      defaultSmsTemplate: `${previous.defaultSmsTemplate} ${marker}`,
      defaultInvoiceMemo: `${previous.defaultInvoiceMemo} ${marker}`,
    };

    const saved = await save(values);

    expect(saved.questionnaire.id).toBe(current.questionnaire.id);
    expect(saved.questionnaireResponse.id).toBe(current.questionnaireResponse.id);
    expect(saved.questionnaireResponse.questionnaire).toBe(`Questionnaire/${current.questionnaire.id}`);
    expect(saved.questionnaireResponse.status).toBe('completed');
    const expected: ParsedInvoiceConfig = {
      ...values,
      invoiceIssuerSource: previous.invoiceIssuerSource,
    };
    expect(parseInvoiceConfigFromQR(saved.questionnaireResponse)).toEqual(expected);

    const stored = await oystehrBilling.fhir.history<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: current.questionnaireResponse.id!,
      versionId: saved.questionnaireResponse.meta!.versionId!,
    });
    expect(parseInvoiceConfigFromQR(stored)).toEqual(expected);
    expect(stored.authored).toBe(saved.questionnaireResponse.authored);
  }, 120_000);
});
