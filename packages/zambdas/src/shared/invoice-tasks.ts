import Oystehr from '@oystehr/sdk';
import { Basic, Encounter, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { RcmTaskCodings } from 'utils/lib/fhir/constants';
import { createReference } from 'utils/lib/fhir/helpers';
import { ParsedInvoiceConfig } from 'utils/lib/helpers/rcm/invoice-config';
import { mapDisplayToInvoiceTaskStatus } from 'utils/lib/helpers/tasks/invoices-tasks';
import { createInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { Secrets } from 'utils/lib/secrets';
import {
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  InvoiceTaskInput,
  InvoiceTaskSource,
  invoiceTaskSourceTag,
  ZERO_BALANCE_BUSINESS_STATUS,
} from 'utils/lib/types/api/invoicing.types';
import { shouldUseCandid, shouldUseOttehrBilling } from './candid';

interface InvoicingFlags {
  ottehrBillingInvoicingEnabled?: boolean;
  invoicingInBillingApp?: boolean;
}

export function isCandidInvoicingEnabled(secrets: Secrets): boolean {
  return shouldUseCandid(secrets);
}

function isOttehrBillingInvoicingEnabled(secrets: Secrets, flags: InvoicingFlags): boolean {
  return shouldUseOttehrBilling(secrets) && (flags.ottehrBillingInvoicingEnabled ?? false);
}

export function isOttehrBillingInvoicingInEhr(secrets: Secrets, flags: InvoicingFlags = FEATURE_FLAGS_CONFIG): boolean {
  return isOttehrBillingInvoicingEnabled(secrets, flags) && !flags.invoicingInBillingApp;
}

export function isOttehrBillingInvoicingInBillingApp(
  secrets: Secrets,
  flags: InvoicingFlags = FEATURE_FLAGS_CONFIG
): boolean {
  return isOttehrBillingInvoicingEnabled(secrets, flags) && (flags.invoicingInBillingApp ?? false);
}

export interface BuildInvoiceTaskParams {
  source: InvoiceTaskSource;
  claimId: string;
  finalizationDateIso: string;
  amountCents: number;
  encounter: Encounter;
  config: ParsedInvoiceConfig;
}

export function buildInvoiceTask(params: BuildInvoiceTaskParams): Task {
  const { source, claimId, finalizationDateIso, amountCents, encounter, config } = params;
  const patientId = encounter.subject?.reference?.replace('Patient/', '');
  if (!patientId) throw new Error('Patient ID not found in encounter: ' + encounter.id);

  const prefilledInvoiceInfo = buildPrefilledInvoiceInput({
    claimId,
    finalizationDateIso,
    amountCents,
    config,
  });

  return {
    resourceType: 'Task',
    status: mapDisplayToInvoiceTaskStatus('ready'),
    description: `Send invoice for $${(amountCents / 100).toFixed(2)}`,
    intent: 'order',
    code: RcmTaskCodings.sendInvoiceToPatient,
    meta: {
      tag: [invoiceTaskSourceTag(source)],
    },
    ...(source === 'ottehr-billing'
      ? {
          identifier: [
            {
              system: INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
              value: claimId,
            },
          ],
        }
      : {}),
    encounter: createReference(encounter),
    for: {
      reference: `Patient/${patientId}`,
    },
    authoredOn: prefilledInvoiceInfo.finalizationDate || DateTime.now().toISO(),
    ...(encounter.period?.start
      ? {
          executionPeriod: {
            start: encounter.period.start,
            end: encounter.period.start,
          },
        }
      : {}),
    ...(amountCents === 0
      ? {
          businessStatus: ZERO_BALANCE_BUSINESS_STATUS,
        }
      : {}),
    input: createInvoiceTaskInput(prefilledInvoiceInfo),
  };
}

// One Basic per visit the billing app invoices, so the Candid cron doesn't give it an EHR invoice too.
const BILLING_APP_INVOICE_MARKER_SYSTEM = 'https://fhir.ottehr.com/visit-invoicing';
const BILLING_APP_INVOICE_MARKER_CODE = 'billing-app';

const billingAppInvoiceMarkerQuery = (encounterId: string): { name: string; value: string }[] => [
  { name: 'subject', value: `Encounter/${encounterId}` },
  { name: 'code', value: `${BILLING_APP_INVOICE_MARKER_SYSTEM}|${BILLING_APP_INVOICE_MARKER_CODE}` },
];

export async function markInvoicedFromBillingApp(oystehr: Oystehr, encounterId: string): Promise<void> {
  await oystehr.fhir.create<Basic>(
    {
      resourceType: 'Basic',
      code: { coding: [{ system: BILLING_APP_INVOICE_MARKER_SYSTEM, code: BILLING_APP_INVOICE_MARKER_CODE }] },
      subject: { reference: `Encounter/${encounterId}` },
    },
    { ifNoneExist: billingAppInvoiceMarkerQuery(encounterId) }
  );
}

export async function isInvoicedFromBillingApp(oystehr: Oystehr, encounterId: string): Promise<boolean> {
  const markers = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [...billingAppInvoiceMarkerQuery(encounterId), { name: '_count', value: '1' }],
  });
  return markers.unbundle().length > 0;
}

export function sendInvoiceTaskDedupeQuery(encounterId: string): { name: string; value: string }[] {
  const coding = RcmTaskCodings.sendInvoiceToPatient.coding?.[0];
  return [
    {
      name: 'encounter',
      value: `Encounter/${encounterId}`,
    },
    {
      name: 'code',
      value: `${coding?.system}|${coding?.code}`,
    },
  ];
}

export function buildPrefilledInvoiceInput(params: {
  claimId: string;
  finalizationDateIso: string;
  amountCents: number;
  config: ParsedInvoiceConfig;
}): InvoiceTaskInput {
  const { claimId, finalizationDateIso, amountCents, config } = params;
  return {
    smsTextMessage: config.defaultSmsTemplate,
    memo: config.defaultInvoiceMemo,
    dueDate: DateTime.now().plus({ days: config.dueDaysFromGeneration }).toISODate(),
    amountCents,
    claimId,
    finalizationDate: finalizationDateIso,
  };
}
