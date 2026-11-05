import Oystehr from '@oystehr/sdk';
import { formatInvoiceNumber } from 'utils/lib/fhir/billing-invoice';
import { nextCounterValue } from '../shared/fhir-counter';

// One counter for patient and NIO invoices.
export const INVOICE_NUMBER_COUNTER_KEY = 'invoice-number';

export async function issueInvoiceNumber(billingOystehr: Oystehr): Promise<string> {
  return formatInvoiceNumber(await nextCounterValue(billingOystehr, INVOICE_NUMBER_COUNTER_KEY));
}
