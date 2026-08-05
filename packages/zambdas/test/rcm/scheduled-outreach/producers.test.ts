import { Encounter, Invoice } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { produceDischargeOutreach } from '../../../src/rcm/scheduled-outreach/producers/shared/produce-discharge-outreach';
import { produceInvoiceIssuedOutreach } from '../../../src/rcm/scheduled-outreach/producers/shared/produce-invoice-issued-outreach';
import { produceOutreachTasks } from '../../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import {
  getOrCreateOutreachConfig,
  parsePlanDefinitionToActions,
} from '../../../src/rcm/scheduled-outreach-config/helpers';

// produceOutreachTasks, getOrCreateOutreachConfig, and parsePlanDefinitionToActions are canonical
// suite-wide mocks (vitest.unit-mocks.setup.ts); per-file defaults are installed in beforeEach below.

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockProduceOutreachTasks = vi.mocked(produceOutreachTasks);

const mockOystehr = {
  fhir: {
    get: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
  },
};

function defaultOutreachResult(): { created: never[]; skipped: never[] } {
  return { created: [], skipped: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProduceOutreachTasks.mockResolvedValue(defaultOutreachResult());
  vi.mocked(getOrCreateOutreachConfig).mockResolvedValue({
    resourceType: 'PlanDefinition',
    id: 'plan-1',
    status: 'active',
    action: [],
  });
  vi.mocked(parsePlanDefinitionToActions).mockReturnValue([]);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('produceDischargeOutreach', () => {
  it('fetches the encounter and produces tasks for both discharge-time and date-of-visit triggers', async () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-1',
      status: 'finished',
      class: { code: 'AMB' },
      subject: { reference: 'Patient/pat-1' },
      period: { start: '2025-01-15T09:00:00Z', end: '2025-01-15T10:00:00Z' },
      appointment: [{ reference: 'Appointment/appt-1' }],
    };

    mockOystehr.fhir.get.mockResolvedValue(encounter);

    await produceDischargeOutreach({ encounterId: 'enc-1', oystehr: mockOystehr as any });

    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(2);

    // First call: discharge-time
    const call1 = mockProduceOutreachTasks.mock.calls[0][0];
    expect(call1.triggerEvent).toBe('discharge-time');
    expect(call1.patient).toEqual({ reference: 'Patient/pat-1' });
    expect(call1.focus).toEqual({ reference: 'Encounter/enc-1' });
    expect(call1.appointment).toEqual({ reference: 'Appointment/appt-1' });
    expect(call1.eventTimestamp).toBe('2025-01-15T10:00:00Z');

    // Second call: date-of-visit
    const call2 = mockProduceOutreachTasks.mock.calls[1][0];
    expect(call2.triggerEvent).toBe('date-of-visit');
    expect(call2.eventTimestamp).toBe('2025-01-15T09:00:00Z');
  });

  it('throws when encounter has no subject', async () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-3',
      status: 'finished',
      class: { code: 'AMB' },
    } as any;

    mockOystehr.fhir.get.mockResolvedValue(encounter);

    await expect(produceDischargeOutreach({ encounterId: 'enc-3', oystehr: mockOystehr as any })).rejects.toThrow();
  });

  it('throws when validateStatus is true and encounter is not finished', async () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-4',
      status: 'in-progress',
      class: { code: 'AMB' },
      subject: { reference: 'Patient/pat-4' },
    };

    mockOystehr.fhir.get.mockResolvedValue(encounter);

    await expect(
      produceDischargeOutreach({ encounterId: 'enc-4', validateStatus: true, oystehr: mockOystehr as any })
    ).rejects.toThrow(/expected 'finished'/);
  });

  it('does not validate status when validateStatus is not set', async () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-5',
      status: 'in-progress',
      class: { code: 'AMB' },
      subject: { reference: 'Patient/pat-5' },
      period: { start: '2025-01-15T09:00:00Z', end: '2025-01-15T10:00:00Z' },
    };

    mockOystehr.fhir.get.mockResolvedValue(encounter);

    await produceDischargeOutreach({ encounterId: 'enc-5', oystehr: mockOystehr as any });

    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(2);
  });
});

describe('produceInvoiceIssuedOutreach', () => {
  it('produces tasks for invoice-issued trigger', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-1',
      status: 'issued',
      subject: { reference: 'Patient/pat-1' },
      date: '2025-03-01',
    };

    mockOystehr.fhir.get.mockResolvedValue(invoice);

    await produceInvoiceIssuedOutreach({ invoiceId: 'inv-1', oystehr: mockOystehr as any });

    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(1);
    const call = mockProduceOutreachTasks.mock.calls[0][0];
    expect(call.triggerEvent).toBe('invoice-issued');
    expect(call.patient).toEqual({ reference: 'Patient/pat-1' });
    expect(call.focus).toEqual({ reference: 'Invoice/inv-1' });
    expect(call.eventTimestamp).toBe('2025-03-01');
  });

  it('includes appointment reference when provided', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-3',
      status: 'issued',
      subject: { reference: 'Patient/pat-3' },
      date: '2025-03-20',
    };

    mockOystehr.fhir.get.mockResolvedValue(invoice);

    await produceInvoiceIssuedOutreach({
      invoiceId: 'inv-3',
      appointmentRef: 'Appointment/appt-1',
      oystehr: mockOystehr as any,
    });

    const call = mockProduceOutreachTasks.mock.calls[0][0];
    expect(call.appointment).toEqual({ reference: 'Appointment/appt-1' });
  });

  it('throws when invoice has no subject', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-4',
      status: 'issued',
    } as any;

    mockOystehr.fhir.get.mockResolvedValue(invoice);

    await expect(produceInvoiceIssuedOutreach({ invoiceId: 'inv-4', oystehr: mockOystehr as any })).rejects.toThrow();
  });

  it('throws when validateStatus is true and invoice is not issued', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-5',
      status: 'draft',
      subject: { reference: 'Patient/pat-5' },
    } as any;

    mockOystehr.fhir.get.mockResolvedValue(invoice);

    await expect(
      produceInvoiceIssuedOutreach({ invoiceId: 'inv-5', validateStatus: true, oystehr: mockOystehr as any })
    ).rejects.toThrow(/expected 'issued'/);
  });

  it('does not validate status when validateStatus is not set', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-6',
      status: 'draft',
      subject: { reference: 'Patient/pat-6' },
      date: '2025-04-01',
    } as any;

    mockOystehr.fhir.get.mockResolvedValue(invoice);

    await produceInvoiceIssuedOutreach({ invoiceId: 'inv-6', oystehr: mockOystehr as any });

    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(1);
  });
});
