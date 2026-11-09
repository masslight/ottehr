import { afterEach, describe, expect, it, vi } from 'vitest';

type FlagState = {
  candid: boolean;
  billing: boolean;
};

const loadNavGroups = async (
  flags: FlagState
): Promise<(typeof import('../../src/features/admin/adminNav'))['adminNavGroups']> => {
  vi.resetModules();
  vi.doMock('src/constants/feature-flags', () => ({
    FEATURE_FLAGS: {
      CANDID_INVOICING_ENABLED: flags.candid,
      OTTEHR_BILLING_INVOICING_ENABLED: flags.billing,
    },
  }));
  const navModule = await import('../../src/features/admin/adminNav');
  return navModule.adminNavGroups;
};

const communicationsEntries = async (flags: FlagState): Promise<{ path: string; label: string }[]> => {
  const groups = await loadNavGroups(flags);
  const communications = groups.find((group) => group.label === 'Communications');
  return (communications?.items ?? []).map((item) => ({
    path: item.path,
    label: item.label,
  }));
};

const communicationsPaths = async (flags: FlagState): Promise<string[]> =>
  (await communicationsEntries(flags)).map((entry) => entry.path);

describe('admin nav invoicing gating', () => {
  afterEach(() => {
    vi.doUnmock('src/constants/feature-flags');
    vi.resetModules();
  });

  it('shows only the candid entry, plainly labeled, when billing invoicing is off', async () => {
    const entries = await communicationsEntries({
      candid: true,
      billing: false,
    });
    const candidEntry = entries.find((entry) => entry.path === '/admin/outreach/patient-invoices');
    expect(candidEntry?.label).toBe('Patient Invoicing');
    expect(entries.map((entry) => entry.path)).not.toContain('/admin/outreach/patient-invoices-billing');
  });

  it('shows only the ottehr billing entry, plainly labeled, when candid invoicing is off', async () => {
    const entries = await communicationsEntries({
      candid: false,
      billing: true,
    });
    const billingEntry = entries.find((entry) => entry.path === '/admin/outreach/patient-invoices-billing');
    expect(billingEntry?.label).toBe('Patient Invoicing');
    expect(entries.map((entry) => entry.path)).not.toContain('/admin/outreach/patient-invoices');
  });

  it('shows both entries with source-suffixed labels when both invoicing sources are on', async () => {
    const entries = await communicationsEntries({
      candid: true,
      billing: true,
    });
    const paths = await communicationsPaths({
      candid: true,
      billing: true,
    });
    expect(paths).toContain('/admin/outreach/patient-invoices');
    expect(paths).toContain('/admin/outreach/patient-invoices-billing');
    const labels = entries.map((entry) => entry.label);
    expect(labels).toContain('Patient Invoicing — Candid');
    expect(labels).toContain('Patient Invoicing — Ottehr Billing');
  });
});
