import Oystehr from '@oystehr/sdk';
import { Invoice } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils';
import { OutreachTaskResult, produceOutreachTasks } from './produce-outreach-tasks';

export interface ProduceInvoiceIssuedOutreachParams {
  /** The Invoice resource, or an invoice ID to fetch it */
  invoice?: Invoice;
  invoiceId?: string;
  /** Optional Appointment reference to link in basedOn */
  appointmentRef?: string;
  oystehr: Oystehr;
}

/**
 * Creates outreach tasks triggered by invoice issuance.
 *
 * Can be called directly from another zambda (e.g., the "Create Invoice" flow)
 * or from the zambda handler.
 */
export async function produceInvoiceIssuedOutreach(
  params: ProduceInvoiceIssuedOutreachParams
): Promise<OutreachTaskResult> {
  const { oystehr } = params;

  let invoice: Invoice;
  if (params.invoice) {
    invoice = params.invoice;
  } else if (params.invoiceId) {
    invoice = await oystehr.fhir.get<Invoice>({
      resourceType: 'Invoice',
      id: params.invoiceId,
    });
  } else {
    throw INVALID_INPUT_ERROR('Expected either invoice or invoiceId');
  }

  if (!invoice.subject?.reference) {
    throw INVALID_INPUT_ERROR(`Invoice ${invoice.id} has no subject (patient) reference`);
  }

  const issuedDate = invoice.date || new Date().toISOString();

  return produceOutreachTasks({
    triggerEvent: 'invoice-issued',
    patient: invoice.subject,
    focus: { reference: `Invoice/${invoice.id}` },
    appointment: params.appointmentRef ? { reference: params.appointmentRef } : undefined,
    eventTimestamp: issuedDate,
    oystehr,
  });
}
