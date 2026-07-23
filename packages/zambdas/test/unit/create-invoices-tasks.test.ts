import type Oystehr from '@oystehr/sdk';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Encounter } from 'fhir/r4b';
import { RcmTaskCodings } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { createTaskForEncounter } from '../../src/cron/create-invoices-tasks/index';
import type { ParsedInvoicingConfig } from '../../src/rcm/invoice-config/helpers';

vi.mock('../../src/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
  };
});

const config: ParsedInvoicingConfig = {
  dueDaysFromGeneration: 30,
  defaultSmsTemplate: 'sms template',
  defaultInvoiceMemo: 'memo template',
};

const encounter = (id: string): Encounter =>
  ({
    resourceType: 'Encounter',
    id,
    status: 'finished',
    class: {
      code: 'AMB',
    },
    subject: {
      reference: 'Patient/pat-1',
    },
    period: {
      start: '2026-07-01T09:00:00Z',
    },
  }) as Encounter;

const inventoryRecord = (): InventoryRecord =>
  ({
    claimId: 'claim-1',
    encounterId: 'candid-1',
    patientExternalId: 'pat-1',
    timestamp: new Date('2026-07-10T12:00:00Z'),
  }) as unknown as InventoryRecord;

describe('create-invoices-tasks createTaskForEncounter', () => {
  it('guards task creation with a per-encounter conditional create', async () => {
    const create = vi.fn(async (task: unknown, _options?: unknown) => ({
      ...(task as object),
      id: 'created-1',
    }));
    const oystehr = {
      fhir: {
        create,
      },
    } as unknown as Oystehr;

    await createTaskForEncounter(
      oystehr,
      {
        encounter: encounter('enc-1'),
        claim: inventoryRecord(),
        amountCents: 5050,
      },
      config
    );

    expect(create).toHaveBeenCalledTimes(1);
    const sendInvoiceCoding = RcmTaskCodings.sendInvoiceToPatient.coding?.[0];
    const options = create.mock.calls[0][1] as { ifNoneExist?: unknown };
    expect(options.ifNoneExist).toEqual([
      {
        name: 'encounter',
        value: 'Encounter/enc-1',
      },
      {
        name: 'code',
        value: `${sendInvoiceCoding?.system}|${sendInvoiceCoding?.code}`,
      },
    ]);
  });
});
