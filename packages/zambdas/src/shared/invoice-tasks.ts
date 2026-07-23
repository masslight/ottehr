import { Encounter, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createReference,
  FEATURE_FLAGS_CONFIG,
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  InvoiceTaskInput,
  InvoiceTaskSource,
  invoiceTaskSourceTag,
  mapDisplayToInvoiceTaskStatus,
  RcmTaskCodings,
  Secrets,
  ZERO_BALANCE_BUSINESS_STATUS,
} from 'utils';
import { ParsedInvoiceConfig } from 'utils/lib/helpers/rcm/invoice-config';
import { createInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import { shouldUseCandid, shouldUseOttehrBilling } from './candid';

interface InvoicingFlags {
  candidInvoicingEnabled?: boolean;
  ottehrBillingInvoicingEnabled?: boolean;
}

export function isCandidInvoicingEnabled(secrets: Secrets, flags: InvoicingFlags = FEATURE_FLAGS_CONFIG): boolean {
  return shouldUseCandid(secrets) && (flags.candidInvoicingEnabled ?? true);
}

export function isOttehrBillingInvoicingEnabled(
  secrets: Secrets,
  flags: InvoicingFlags = FEATURE_FLAGS_CONFIG
): boolean {
  return shouldUseOttehrBilling(secrets) && (flags.ottehrBillingInvoicingEnabled ?? false);
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
