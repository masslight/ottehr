import { DateTime } from 'luxon';
import {
  DEFAULT_INVOICE_DUE_DAYS,
  DEFAULT_INVOICE_MEMO_TEMPLATE,
  DEFAULT_INVOICE_SMS_TEMPLATE,
} from '../../types/constants';
import { replaceTemplateVariablesHandlebars } from '../helpers';

export interface ParsedInvoiceConfig {
  dueDaysFromGeneration: number;
  defaultSmsTemplate: string;
  defaultInvoiceMemo: string;
}

export function parseInvoiceConfigFromQR(
  qr:
    | {
        item?: {
          linkId: string;
          item?: {
            linkId: string;
            answer?: { valueInteger?: number; valueBoolean?: boolean; valueString?: string }[];
          }[];
        }[];
      }
    | undefined
): ParsedInvoiceConfig {
  const group = qr?.item?.find((i) => i.linkId === 'invoicing');
  const items = group?.item ?? [];
  const findAnswer = (
    linkId: string
  ): { valueInteger?: number; valueBoolean?: boolean; valueString?: string } | undefined =>
    items.find((i) => i.linkId === linkId)?.answer?.[0];
  return {
    dueDaysFromGeneration: findAnswer('invoicing.dueDaysFromGeneration')?.valueInteger ?? DEFAULT_INVOICE_DUE_DAYS,
    defaultSmsTemplate: findAnswer('invoicing.defaultSmsTemplate')?.valueString ?? DEFAULT_INVOICE_SMS_TEMPLATE,
    defaultInvoiceMemo: findAnswer('invoicing.defaultInvoiceMemo')?.valueString ?? DEFAULT_INVOICE_MEMO_TEMPLATE,
  };
}

// ---------------------------------------------------------------------------
// Invoice placeholder formatting & resolution
// ---------------------------------------------------------------------------

const INVOICE_DATE_FORMAT = 'EEEE, MMMM d, yyyy';

/**
 * Formats a date string (ISO or MM/dd/yyyy) into a human-readable form,
 * or returns the provided fallback (or the raw string) if it cannot be parsed.
 */
export function formatInvoiceDate(raw: string | undefined, fallback?: string): string {
  if (!raw) return fallback ?? '';
  const dt = DateTime.fromISO(raw);
  if (dt.isValid) return dt.toFormat(INVOICE_DATE_FORMAT);
  const dtUs = DateTime.fromFormat(raw, 'MM/dd/yyyy');
  if (dtUs.isValid) return dtUs.toFormat(INVOICE_DATE_FORMAT);
  return raw;
}

/**
 * Formats an amount in cents as a US-dollar currency string, e.g. "$125.00".
 */
export function formatInvoiceAmount(amountCents: number | undefined, fallback?: string): string {
  if (amountCents == null) return fallback ?? '';
  return `$${(amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Raw input values for building invoice placeholder dictionaries. */
export interface InvoicePlaceholderInput {
  patientFullName?: string;
  clinic?: string;
  location?: string;
  /** ISO or MM/dd/yyyy date string */
  visitDate?: string;
  /** ISO or MM/dd/yyyy date string */
  dueDate?: string;
  /** Amount in cents */
  amountCents?: number;
  invoiceLink?: string;
  patientPortalLink?: string;
}

/**
 * Builds a bare-key placeholder dictionary from raw invoice data,
 * formatting dates and currency consistently.
 */
export function buildInvoicePlaceholders(
  input: InvoicePlaceholderInput,
  fallbacks?: Partial<Record<string, string>>
): Record<string, string> {
  const fb = fallbacks ?? {};
  const result: Record<string, string> = {};
  const set = (key: string, value: string | undefined): void => {
    const v = value || fb[key];
    if (v) result[key] = v;
  };
  set('patient-full-name', input.patientFullName);
  set('clinic', input.clinic);
  set('location', input.location);
  set('visit-date', formatInvoiceDate(input.visitDate, fb['visit-date']));
  set('due-date', formatInvoiceDate(input.dueDate, fb['due-date']));
  set('amount', formatInvoiceAmount(input.amountCents, fb['amount']));
  set('invoice-link', input.invoiceLink);
  set('patient-portal-link', input.patientPortalLink);
  return result;
}

/**
 * Resolves a template string by formatting raw invoice data into placeholders
 * and performing {{key}} substitution.
 */
export function fillInvoiceTemplate(template: string, input: InvoicePlaceholderInput): string {
  return replaceTemplateVariablesHandlebars(template, buildInvoicePlaceholders(input));
}
