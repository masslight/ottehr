import { Coding, Identifier, Invoice, Money, Reference } from 'fhir/r4b';
import { ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT } from './constants';

export const INVOICE_CLAIM_EXTENSION_URL = 'https://fhir.ottehr.com/billing/invoice-claim';
export const INVOICE_CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/invoice-claim-id';
export const INVOICE_DUE_DATE_EXTENSION_URL = 'https://fhir.ottehr.com/billing/invoice-due-date';
export const STRIPE_INVOICE_ID_SYSTEM = 'https://api.stripe.com/v1/invoices';

export interface BillingInvoiceClaim {
  claimId: string;
  amountCents: number;
}

export interface BuildBillingInvoiceInput {
  status: Invoice['status'];
  // Issue date as an ISO date time.
  date: string;
  // Due date as YYYY-MM-DD.
  dueDate: string;
  issuer?: Reference;
  recipient: Reference;
  // Leave empty when the claims cover more than one patient.
  subject?: Reference;
  claims: BillingInvoiceClaim[];
}

export interface StripeInvoiceLink {
  stripeInvoiceId: string;
  stripeAccount?: string;
}

const centsToMoney = (cents: number): Money => ({ value: cents / 100, currency: 'USD' });

// Claim Details finds a claim's invoices by searching this tag.
export const invoiceClaimTag = (claimId: string): Coding => ({
  system: INVOICE_CLAIM_TAG_SYSTEM,
  code: claimId,
});

export function buildBillingInvoice(input: BuildBillingInvoiceInput): Invoice {
  if (input.claims.length === 0) throw new Error('An invoice needs at least one claim');
  const invalid = input.claims.find((claim) => !Number.isInteger(claim.amountCents) || claim.amountCents <= 0);
  if (invalid) throw new Error(`Claim ${invalid.claimId} amount must be a positive whole number of cents`);

  const totalCents = input.claims.reduce((sum, claim) => sum + claim.amountCents, 0);
  return {
    resourceType: 'Invoice',
    meta: { tag: input.claims.map((claim) => invoiceClaimTag(claim.claimId)) },
    extension: [{ url: INVOICE_DUE_DATE_EXTENSION_URL, valueDate: input.dueDate }],
    status: input.status,
    date: input.date,
    issuer: input.issuer,
    recipient: input.recipient,
    subject: input.subject,
    lineItem: input.claims.map((claim, index) => ({
      sequence: index + 1,
      extension: [{ url: INVOICE_CLAIM_EXTENSION_URL, valueReference: { reference: `Claim/${claim.claimId}` } }],
      // FHIR requires a charge item on each line. The claim is linked through the extension above.
      chargeItemCodeableConcept: { text: 'Claim' },
      priceComponent: [{ type: 'base', amount: centsToMoney(claim.amountCents) }],
    })),
    totalGross: centsToMoney(totalCents),
  };
}

export function getBillingInvoiceClaims(invoice: Invoice): BillingInvoiceClaim[] {
  return (invoice.lineItem ?? []).map((item) => {
    const reference = item.extension?.find((ext) => ext.url === INVOICE_CLAIM_EXTENSION_URL)?.valueReference?.reference;
    const amount = item.priceComponent?.find((component) => component.type === 'base')?.amount;
    if (!reference?.startsWith('Claim/') || amount?.value === undefined || amount.currency !== 'USD') {
      throw new Error(`Invoice ${invoice.id} has a malformed claim line`);
    }
    return { claimId: reference.slice('Claim/'.length), amountCents: Math.round(amount.value * 100) };
  });
}

export const getBillingInvoiceDueDate = (invoice: Invoice): string | undefined =>
  invoice.extension?.find((ext) => ext.url === INVOICE_DUE_DATE_EXTENSION_URL)?.valueDate;

// Same shape as the Stripe customer IDs on Account. Projects without connected accounts have no account extension.
export function withStripeInvoiceLink(invoice: Invoice, link: StripeInvoiceLink): Invoice {
  const existing = getStripeInvoiceLink(invoice);
  if (existing) {
    if (existing.stripeInvoiceId === link.stripeInvoiceId && existing.stripeAccount === link.stripeAccount) {
      return invoice;
    }
    // Replacing the link would leave the old Stripe invoice payable with nothing pointing at it.
    throw new Error(`Invoice ${invoice.id} is already linked to Stripe invoice ${existing.stripeInvoiceId}`);
  }

  const identifier: Identifier = { system: STRIPE_INVOICE_ID_SYSTEM, value: link.stripeInvoiceId };
  if (link.stripeAccount) {
    identifier.extension = [
      { url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT, valueString: link.stripeAccount },
    ];
  }
  return { ...invoice, identifier: [...(invoice.identifier ?? []), identifier] };
}

export function getStripeInvoiceLink(invoice: Invoice): StripeInvoiceLink | undefined {
  const identifier = invoice.identifier?.find((ident) => ident.system === STRIPE_INVOICE_ID_SYSTEM);
  if (!identifier?.value) return undefined;
  const stripeAccount = identifier.extension?.find(
    (ext) => ext.url === ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT
  )?.valueString;
  return { stripeInvoiceId: identifier.value, stripeAccount };
}
