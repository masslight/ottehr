import {
  DEFAULT_INVOICE_DUE_DAYS,
  DEFAULT_INVOICE_MEMO_TEMPLATE,
  DEFAULT_INVOICE_SMS_TEMPLATE,
} from '../../types/constants';

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
