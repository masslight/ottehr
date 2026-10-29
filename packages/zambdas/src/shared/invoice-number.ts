import Oystehr from '@oystehr/sdk';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { IssueBillingInvoiceNumberResponse } from 'utils/lib/types/data/billing/billing.types';

// Billing owns invoice numbering, so every caller goes through its zambda.
export async function nextInvoiceNumber(oystehr: Oystehr): Promise<string> {
  const response = await oystehr.zambda.execute({
    id: 'issue-billing-invoice-number',
  });
  return chooseJson<IssueBillingInvoiceNumberResponse>(response).invoiceNumber;
}
