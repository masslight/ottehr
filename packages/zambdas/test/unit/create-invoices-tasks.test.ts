import type Oystehr from '@oystehr/sdk';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Basic, Encounter, Resource } from 'fhir/r4b';
import { RcmTaskCodings } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import { createTaskForEncounter } from '../../src/cron/create-invoices-tasks/index';
import type { ParsedInvoicingConfig } from '../../src/rcm/invoice-config/helpers';
import { markInvoicedFromBillingApp } from '../../src/shared/invoice-tasks';

vi.mock('../../src/shared/sentry', async (importOriginal) => {
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
  // The client has no search, so this also shows the cron doesn't look for billing app markers by default.
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

  it('skips a visit the billing app marked when the project invoices from the billing app', async () => {
    const created: Resource[] = [];
    const create = vi.fn(async (resource: Resource) => {
      created.push(resource);
      return resource;
    });
    // Finds the markers created for the encounter the search names.
    const search = vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => ({
      unbundle: () =>
        created.filter(
          (resource) =>
            (resource as Basic).subject?.reference === params.find((param) => param.name === 'subject')?.value
        ),
    }));
    const oystehr = { fhir: { create, search } } as unknown as Oystehr;
    const pkg = { encounter: encounter('enc-1'), claim: inventoryRecord(), amountCents: 5050 };

    await markInvoicedFromBillingApp(oystehr, 'enc-1');
    await createTaskForEncounter(oystehr, pkg, config, true);
    await createTaskForEncounter(oystehr, { ...pkg, encounter: encounter('enc-2') }, config, true);

    expect(created.map((resource) => resource.resourceType)).toEqual(['Basic', 'Task']);
    expect(created[1]).toMatchObject({ encounter: { reference: 'Encounter/enc-2' } });
  });
});
