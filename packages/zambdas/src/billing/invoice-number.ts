import Oystehr from '@oystehr/sdk';
import { formatInvoiceNumber } from 'utils/lib/fhir/billing-invoice';
import { nextCounterValue } from '../shared/fhir-counter';

// One counter for patient and NIO invoices.
const INVOICE_NUMBER_COUNTER_KEY = 'invoice-number';

export const nextInvoiceNumber = async (oystehr: Oystehr): Promise<string> =>
  formatInvoiceNumber(await nextCounterValue(oystehr, INVOICE_NUMBER_COUNTER_KEY));
