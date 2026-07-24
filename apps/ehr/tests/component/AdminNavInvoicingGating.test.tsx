import { afterEach, describe, expect, it, vi } from 'vitest';

type FlagState = {
  billing: boolean;
};

const loadNavGroups = async (
  flags: FlagState
): Promise<(typeof import('../../src/features/admin/adminNav'))['adminNavGroups']> => {
  vi.resetModules();
  vi.doMock('src/constants/feature-flags', () => ({
    FEATURE_FLAGS: {
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
      billing: false,
    });
    const candidEntry = entries.find((entry) => entry.path === '/admin/outreach/patient-invoices');
    expect(candidEntry?.label).toBe('Patient Invoicing');
    expect(entries.map((entry) => entry.path)).not.toContain('/admin/outreach/patient-invoices-billing');
  });

  it('shows both entries with source-suffixed labels when billing invoicing is on', async () => {
    const entries = await communicationsEntries({
      billing: true,
    });
    const paths = await communicationsPaths({
      billing: true,
    });
    expect(paths).toContain('/admin/outreach/patient-invoices');
    expect(paths).toContain('/admin/outreach/patient-invoices-billing');
    const labels = entries.map((entry) => entry.label);
    expect(labels).toContain('Patient Invoicing — Candid');
    expect(labels).toContain('Patient Invoicing — Ottehr Billing');
  });
});
