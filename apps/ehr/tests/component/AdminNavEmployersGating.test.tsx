import { afterEach, describe, expect, it, vi } from 'vitest';

type FlagState = {
  nio: boolean;
};

const loadNavGroups = async (
  flags: FlagState
): Promise<(typeof import('../../src/features/admin/adminNav'))['adminNavGroups']> => {
  vi.resetModules();
  vi.doMock('src/constants/feature-flags', () => ({
    FEATURE_FLAGS: {
      OTTEHR_BILLING_INVOICING_ENABLED: false,
      NON_INSURANCE_ORGANIZATIONS_ENABLED: flags.nio,
    },
  }));
  const navModule = await import('../../src/features/admin/adminNav');
  return navModule.adminNavGroups;
};

const billingPaths = async (flags: FlagState): Promise<string[]> => {
  const groups = await loadNavGroups(flags);
  const billing = groups.find((group) => group.label === 'Billing');
  return (billing?.items ?? []).map((item) => item.path);
};

describe('admin nav employers gating', () => {
  afterEach(() => {
    vi.doUnmock('src/constants/feature-flags');
    vi.resetModules();
  });

  it('shows the legacy Employers tab when non-insurance organizations are off', async () => {
    const paths = await billingPaths({ nio: false });
    expect(paths).toContain('/admin/billing/employers');
  });

  it('hides the legacy Employers tab when non-insurance organizations are on', async () => {
    const paths = await billingPaths({ nio: true });
    expect(paths).not.toContain('/admin/billing/employers');
    // The rest of the Billing group is untouched by the flag.
    expect(paths).toContain('/admin/billing/insurance');
    expect(paths).toContain('/admin/billing/fee-schedules');
  });
});
