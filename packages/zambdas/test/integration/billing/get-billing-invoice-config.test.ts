import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import { InvoiceConfigResponse } from 'utils/lib/types/api/invoice-config.types';
import { INVOICE_ISSUER_SOURCES } from 'utils/lib/types/constants';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INVOICING_CONFIG_QUESTIONNAIRE_URL } from '../../../src/rcm/invoice-config/helpers';
import { isOttehrBillingInvoicingInBillingApp } from '../../../src/shared/invoice-tasks';
import { setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { loadZambdaSecrets } from '../../helpers/invoke-zambda-handler';

describe('get-billing-invoice-config', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-invoice-config.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = setup.oystehrBilling;
    cleanup = setup.cleanup;
  }, 120_000);

  afterAll(async () => {
    await cleanup();
  }, 120_000);

  it('returns the billing invoicing Questionnaire with its linked response and the invoicing location', async () => {
    const output = (await oystehr.zambda.execute({ id: 'get-billing-invoice-config' }))
      .output as unknown as InvoiceConfigResponse;

    expect(output.questionnaire.url).toBe(INVOICING_CONFIG_QUESTIONNAIRE_URL);
    expect(output.questionnaireResponse.questionnaire).toBe(`Questionnaire/${output.questionnaire.id}`);
    expect(output.invoicingInBillingApp).toBe(isOttehrBillingInvoicingInBillingApp(loadZambdaSecrets()));

    const config = parseInvoiceConfigFromQR(output.questionnaireResponse);
    expect(config.dueDaysFromGeneration).toBeGreaterThanOrEqual(1);
    expect(config.defaultSmsTemplate.trim()).not.toBe('');
    expect(config.defaultInvoiceMemo.trim()).not.toBe('');
    expect(INVOICE_ISSUER_SOURCES).toContain(config.invoiceIssuerSource);

    const stored = await oystehrBilling.fhir.history<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: output.questionnaireResponse.id!,
      versionId: output.questionnaireResponse.meta!.versionId!,
    });
    expect(parseInvoiceConfigFromQR(stored)).toEqual(config);
  }, 120_000);
});
