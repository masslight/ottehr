import Oystehr from '@oystehr/sdk';
import { ChargeItem, Invoice } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils';
import { OutreachTaskResult, produceOutreachTasks } from './produce-outreach-tasks';

/** Action types that can execute without an Encounter focus. */
const INVOICE_SAFE_ACTION_TYPES = new Set(['send-notification', 'log']);

export interface ProduceInvoiceIssuedOutreachParams {
  /** Invoice ID to fetch */
  invoiceId: string;
  /** When true, validates the invoice is in 'issued' status before proceeding */
  validateStatus?: boolean;
  /** Optional Appointment reference to link in basedOn */
  appointmentRef?: string;
  /** Optional Encounter reference. If omitted, resolved from Invoice lineItem ChargeItems. */
  encounterRef?: string;
  oystehr: Oystehr;
}

/**
 * Creates outreach tasks triggered by invoice issuance.
 *
 * Executors (charge-card, paper-mail) require an Encounter focus.
 * When an encounter reference is available (via param or resolved from ChargeItems),
 * the encounter is used as focus so all action types work.
 * Otherwise, only action types that work without an Encounter focus are produced.
 */
export async function produceInvoiceIssuedOutreach(
  params: ProduceInvoiceIssuedOutreachParams
): Promise<OutreachTaskResult> {
  const { invoiceId, oystehr } = params;

  const invoice = await oystehr.fhir.get<Invoice>({
    resourceType: 'Invoice',
    id: invoiceId,
  });

  if (params.validateStatus && invoice.status !== 'issued') {
    throw INVALID_INPUT_ERROR(`Invoice ${invoice.id} is in '${invoice.status}' status, expected 'issued'`);
  }

  if (!invoice.subject?.reference) {
    throw INVALID_INPUT_ERROR(`Invoice ${invoice.id} has no subject (patient) reference`);
  }

  const issuedDate = invoice.date || new Date().toISOString();

  // Resolve encounter reference: use param, or look up from Invoice lineItem ChargeItems
  let encounterRef = params.encounterRef;
  if (!encounterRef) {
    encounterRef = await resolveEncounterFromInvoice(invoice, oystehr);
  }

  // When encounter is available, use it as focus (compatible with all executors)
  const focus = encounterRef ? { reference: encounterRef } : { reference: `Invoice/${invoice.id}` };

  return produceOutreachTasks({
    triggerEvent: 'invoice-issued',
    patient: invoice.subject,
    focus,
    appointment: params.appointmentRef ? { reference: params.appointmentRef } : undefined,
    eventTimestamp: issuedDate,
    oystehr,
    // When no encounter is available, only produce actions that can work with Invoice focus
    actionFilter: encounterRef ? undefined : (a) => INVOICE_SAFE_ACTION_TYPES.has(a.actionType),
  });
}

/**
 * Try to resolve an Encounter reference from the Invoice's lineItem ChargeItem references.
 */
async function resolveEncounterFromInvoice(invoice: Invoice, oystehr: Oystehr): Promise<string | undefined> {
  const chargeItemRefs = invoice.lineItem
    ?.map((li) => li.chargeItemReference?.reference)
    .filter((ref): ref is string => !!ref && ref.startsWith('ChargeItem/'));

  if (!chargeItemRefs?.length) return undefined;

  try {
    const chargeItemId = chargeItemRefs[0].replace('ChargeItem/', '');
    const chargeItem = await oystehr.fhir.get<ChargeItem>({ resourceType: 'ChargeItem', id: chargeItemId });
    const encounterRef = chargeItem.context?.reference;
    if (encounterRef?.startsWith('Encounter/')) return encounterRef;
  } catch (err) {
    console.warn(`Could not resolve encounter from Invoice ${invoice.id} ChargeItem:`, err);
  }

  return undefined;
}
