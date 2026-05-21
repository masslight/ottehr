import { Encounter, Invoice } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockProduceOutreachTasks = vi.fn();

vi.mock('../../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks', () => ({
  produceOutreachTasks: mockProduceOutreachTasks,
  OUTREACH_TASK_TAG_SYSTEM: 'https://fhir.ottehr.com/r4/outreach-task',
}));

const mockOystehr = {
  fhir: {
    get: vi.fn(),
    search: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('../../../src/rcm/scheduled-outreach-config/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOrCreateOutreachConfig: vi
      .fn()
      .mockResolvedValue({ resourceType: 'PlanDefinition', id: 'plan-1', status: 'active', action: [] }),
    parsePlanDefinitionToActions: vi.fn().mockReturnValue([]),
  };
});

function defaultOutreachResult(): { created: never[]; skipped: never[] } {
  return { created: [], skipped: [] };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('produceDischargeOutreach', () => {
  let produceDischargeOutreach: typeof import('../../../src/rcm/scheduled-outreach/producers/shared/produce-discharge-outreach').produceDischargeOutreach;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockProduceOutreachTasks.mockResolvedValue(defaultOutreachResult());
    const mod = await import('../../../src/rcm/scheduled-outreach/producers/shared/produce-discharge-outreach');
    produceDischargeOutreach = mod.produceDischargeOutreach;
  });

  it('produces tasks for both discharge-time and date-of-visit triggers', async () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-1',
      status: 'finished',
      class: { code: 'AMB' },
      subject: { reference: 'Patient/pat-1' },
      period: { start: '2025-01-15T09:00:00Z', end: '2025-01-15T10:00:00Z' },
      appointment: [{ reference: 'Appointment/appt-1' }],
    };

    await produceDischargeOutreach({ encounter, oystehr: mockOystehr as any });

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

  it('fetches encounter by ID when only encounterId is provided', async () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-2',
      status: 'finished',
      class: { code: 'AMB' },
      subject: { reference: 'Patient/pat-2' },
      period: { start: '2025-02-01T08:00:00Z', end: '2025-02-01T09:00:00Z' },
    };

    mockOystehr.fhir.get.mockResolvedValue(encounter);

    await produceDischargeOutreach({ encounterId: 'enc-2', oystehr: mockOystehr as any });

    expect(mockOystehr.fhir.get).toHaveBeenCalledWith({
      resourceType: 'Encounter',
      id: 'enc-2',
    });
    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(2);
  });

  it('throws when neither encounter nor encounterId is provided', async () => {
    await expect(produceDischargeOutreach({ oystehr: mockOystehr as any })).rejects.toThrow();
  });

  it('throws when encounter has no subject', async () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-3',
      status: 'finished',
      class: { code: 'AMB' },
    } as any;

    await expect(produceDischargeOutreach({ encounter, oystehr: mockOystehr as any })).rejects.toThrow();
  });

  it('throws when validateStatus is true and encounter is not finished', async () => {
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: 'enc-4',
      status: 'in-progress',
      class: { code: 'AMB' },
      subject: { reference: 'Patient/pat-4' },
    };

    await expect(
      produceDischargeOutreach({ encounter, validateStatus: true, oystehr: mockOystehr as any })
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

    await produceDischargeOutreach({ encounter, oystehr: mockOystehr as any });

    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(2);
  });
});

describe('produceInvoiceIssuedOutreach', () => {
  let produceInvoiceIssuedOutreach: typeof import('../../../src/rcm/scheduled-outreach/producers/shared/produce-invoice-issued-outreach').produceInvoiceIssuedOutreach;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockProduceOutreachTasks.mockResolvedValue(defaultOutreachResult());
    const mod = await import('../../../src/rcm/scheduled-outreach/producers/shared/produce-invoice-issued-outreach');
    produceInvoiceIssuedOutreach = mod.produceInvoiceIssuedOutreach;
  });

  it('produces tasks for invoice-issued trigger', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-1',
      status: 'issued',
      subject: { reference: 'Patient/pat-1' },
      date: '2025-03-01',
    };

    await produceInvoiceIssuedOutreach({ invoice, oystehr: mockOystehr as any });

    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(1);
    const call = mockProduceOutreachTasks.mock.calls[0][0];
    expect(call.triggerEvent).toBe('invoice-issued');
    expect(call.patient).toEqual({ reference: 'Patient/pat-1' });
    expect(call.focus).toEqual({ reference: 'Invoice/inv-1' });
    expect(call.eventTimestamp).toBe('2025-03-01');
  });

  it('fetches invoice by ID when only invoiceId is provided', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-2',
      status: 'issued',
      subject: { reference: 'Patient/pat-2' },
      date: '2025-03-15',
    };

    mockOystehr.fhir.get.mockResolvedValue(invoice);

    await produceInvoiceIssuedOutreach({ invoiceId: 'inv-2', oystehr: mockOystehr as any });

    expect(mockOystehr.fhir.get).toHaveBeenCalledWith({
      resourceType: 'Invoice',
      id: 'inv-2',
    });
    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(1);
  });

  it('includes appointment reference when provided', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-3',
      status: 'issued',
      subject: { reference: 'Patient/pat-3' },
      date: '2025-03-20',
    };

    await produceInvoiceIssuedOutreach({
      invoice,
      appointmentRef: 'Appointment/appt-1',
      oystehr: mockOystehr as any,
    });

    const call = mockProduceOutreachTasks.mock.calls[0][0];
    expect(call.appointment).toEqual({ reference: 'Appointment/appt-1' });
  });

  it('throws when neither invoice nor invoiceId is provided', async () => {
    await expect(produceInvoiceIssuedOutreach({ oystehr: mockOystehr as any })).rejects.toThrow();
  });

  it('throws when invoice has no subject', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-4',
      status: 'issued',
    } as any;

    await expect(produceInvoiceIssuedOutreach({ invoice, oystehr: mockOystehr as any })).rejects.toThrow();
  });

  it('throws when validateStatus is true and invoice is not issued', async () => {
    const invoice: Invoice = {
      resourceType: 'Invoice',
      id: 'inv-5',
      status: 'draft',
      subject: { reference: 'Patient/pat-5' },
    } as any;

    await expect(
      produceInvoiceIssuedOutreach({ invoice, validateStatus: true, oystehr: mockOystehr as any })
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

    await produceInvoiceIssuedOutreach({ invoice, oystehr: mockOystehr as any });

    expect(mockProduceOutreachTasks).toHaveBeenCalledTimes(1);
  });
});
