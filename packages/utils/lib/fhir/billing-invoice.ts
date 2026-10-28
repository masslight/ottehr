import {
  Address,
  Coding,
  Extension,
  Identifier,
  Invoice,
  Location,
  Money,
  Organization,
  PaymentNotice,
  Practitioner,
  Reference,
} from 'fhir/r4b';
import { isEqual } from 'lodash-es';
import { Stripe } from 'stripe';
import { InvoiceIssuerSource } from '../types/constants';
import { INVALID_INPUT_ERROR } from '../types/errors';
import { ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT } from './constants';
import { ottehrIdentifierSystem } from './systemUrls';

export const INVOICE_CLAIM_EXTENSION_URL = 'https://fhir.ottehr.com/billing/invoice-claim';
export const INVOICE_CLAIM_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/invoice-claim-id';
export const INVOICE_DUE_DATE_EXTENSION_URL = 'https://fhir.ottehr.com/billing/invoice-due-date';
export const INVOICE_NUMBER_IDENTIFIER_SYSTEM = 'https://fhir.ottehr.com/billing/invoice-number';
export const INVOICE_PAYMENT_EXTENSION_URL = 'https://fhir.ottehr.com/billing/invoice-payment';
export const INVOICE_PAYMENT_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/invoice-payment-id';
// On the contained PaymentReconciliation of an invoice payment, for every payment method.
export const PAYMENT_REFERENCE_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('payment-reference');
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

// The FHIR statuses billing invoices use; entered-in-error is never set.
export const BILLING_INVOICE_STATUSES = ['draft', 'issued', 'balanced', 'cancelled'] as const;
export type BillingInvoiceStatus = (typeof BILLING_INVOICE_STATUSES)[number];

const INVOICE_STATUS_BY_STRIPE_STATUS: Partial<Record<Stripe.Invoice.Status, BillingInvoiceStatus>> = {
  draft: 'draft',
  open: 'issued',
  paid: 'balanced',
  void: 'cancelled',
};

export function invoiceStatusFromStripe(stripeStatus: Stripe.Invoice.Status): BillingInvoiceStatus {
  const status = INVOICE_STATUS_BY_STRIPE_STATUS[stripeStatus];
  if (!status) throw new Error(`Stripe invoice status ${stripeStatus} has no FHIR invoice status`);
  return status;
}

// Past due is derived rather than stored because FHIR has no such status. today is YYYY-MM-DD.
export function isInvoicePastDue(invoice: Invoice, today: string): boolean {
  const dueDate = getBillingInvoiceDueDate(invoice);
  return invoice.status === 'issued' && dueDate !== undefined && dueDate < today;
}

// Patient and NIO invoices share one number space.
export function formatInvoiceNumber(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error(`Invoice number ${sequence} must be a positive whole number`);
  }
  return `INV-${String(sequence).padStart(5, '0')}`;
}

export const getInvoiceNumber = (invoice: Invoice): string | undefined =>
  invoice.identifier?.find((ident) => ident.system === INVOICE_NUMBER_IDENTIFIER_SYSTEM)?.value;

// Payments for an invoice are found by searching this tag.
export const invoicePaymentTag = (invoiceId: string): Coding => ({
  system: INVOICE_PAYMENT_TAG_SYSTEM,
  code: invoiceId,
});

export const invoicePaymentExtension = (invoiceId: string): Extension => ({
  url: INVOICE_PAYMENT_EXTENSION_URL,
  valueReference: {
    reference: `Invoice/${invoiceId}`,
  },
});

export function getPaymentNoticeInvoiceId(notice: PaymentNotice): string | undefined {
  const reference = notice.extension?.find((ext) => ext.url === INVOICE_PAYMENT_EXTENSION_URL)?.valueReference
    ?.reference;
  return reference?.startsWith('Invoice/') ? reference.slice('Invoice/'.length) : undefined;
}

export const BILLING_INVOICE_KINDS = ['patient', 'nio'] as const;
export type BillingInvoiceKind = (typeof BILLING_INVOICE_KINDS)[number];

export function getBillingInvoiceKind(invoice: Invoice): BillingInvoiceKind {
  const recipientType = invoice.recipient?.reference?.split('/')[0];
  if (recipientType === 'Organization') return 'nio';
  if (recipientType === 'Patient' || recipientType === 'RelatedPerson') return 'patient';
  throw new Error(`Invoice ${invoice.id} has no Organization, Patient or RelatedPerson recipient`);
}

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

// name and address are the invoice's "from" block; organization is Invoice.issuer
export interface InvoiceIssuer {
  organization: Reference;
  name: string;
  address: Address;
}

export interface ResolveInvoiceIssuerInput {
  source: InvoiceIssuerSource;
  facility: Location | undefined;
  billingProvider: Organization | Practitioner | undefined;
}

// R4B Invoice.issuer can only be an Organization. Service facilities have no managing Organization
// today, so a facility-sourced issuer falls back to the billing provider's Organization.
export function resolveInvoiceIssuer({ source, facility, billingProvider }: ResolveInvoiceIssuerInput): InvoiceIssuer {
  const billingOrganization: Reference | undefined =
    billingProvider?.resourceType === 'Organization' && billingProvider.id
      ? {
          reference: `Organization/${billingProvider.id}`,
        }
      : undefined;

  if (source === 'service-facility') {
    if (!facility) throw INVALID_INPUT_ERROR('The claim has no service facility to send the invoice from');
    const organization = facility.managingOrganization ?? billingOrganization;
    if (!organization) {
      throw INVALID_INPUT_ERROR(
        `Service facility ${facility.name ?? facility.id} has no managing organization and the claim's ` +
          'billing provider is not an organization'
      );
    }
    return issuerWithDetails(organization, facility.name, facility.address, `Service facility ${facility.id}`);
  }

  if (!billingOrganization || billingProvider?.resourceType !== 'Organization') {
    throw INVALID_INPUT_ERROR("The claim's billing provider must be an organization to issue an invoice");
  }
  return issuerWithDetails(
    billingOrganization,
    billingProvider.name,
    billingProvider.address?.[0],
    `Billing provider ${billingProvider.id}`
  );
}

function issuerWithDetails(
  organization: Reference,
  name: string | undefined,
  address: Address | undefined,
  label: string
): InvoiceIssuer {
  if (!name) throw INVALID_INPUT_ERROR(`${label} has no name to send the invoice from`);
  if (!address) throw INVALID_INPUT_ERROR(`${label} has no address to send the invoice from`);
  return {
    organization,
    name,
    address,
  };
}

// Claims at one facility each point at their own working copy, so issuers compare by content.
export const isSameInvoiceIssuer = (a: InvoiceIssuer, b: InvoiceIssuer): boolean =>
  a.organization.reference === b.organization.reference && a.name === b.name && isEqual(a.address, b.address);
