import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ChargeItemDefinition, Organization } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { flags, listEmployersMock } = vi.hoisted(() => ({
  flags: { nio: true },
  listEmployersMock: vi.fn(),
}));

// The flag is a frozen compile-time constant, so tests toggle it through a getter
// backed by a hoisted mutable object instead of re-importing modules.
vi.mock('src/constants/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/constants/feature-flags')>();
  return {
    ...actual,
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      get NON_INSURANCE_ORGANIZATIONS_ENABLED() {
        return flags.nio;
      },
    },
  };
});

vi.mock('src/rcm/state/employers/employers.api', () => ({
  listEmployers: listEmployersMock,
  createEmployer: vi.fn(),
  updateEmployer: vi.fn(),
}));

// A stable client object so query hooks don't re-run on every render.
const clients = { oystehr: undefined, oystehrZambda: {} };
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => clients,
}));

const insuranceOrg: Organization = {
  resourceType: 'Organization',
  id: 'ins-1',
  name: 'Aetna Better Health',
  active: true,
};

vi.mock('src/features/visits/telemed/components/admin/admin.queries', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    useInsurancesQuery: () => ({ data: [insuranceOrg], isPending: false }),
  };
});

import PayerAssociations from '../../src/features/visits/telemed/components/admin/charge-items/PayerAssociations';

const employerOrg: Organization = {
  resourceType: 'Organization',
  id: 'emp-1',
  name: 'Acme Industrial Corp',
  active: true,
};

const feeSchedule: ChargeItemDefinition = {
  resourceType: 'ChargeItemDefinition',
  id: 'fee-schedule-1',
  url: 'https://example.com/fee-schedule-1',
  status: 'active',
  useContext: [{ code: { code: 'program' }, valueReference: { reference: 'Organization/ins-1' } }],
};

const renderPayerAssociations = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PayerAssociations feeSchedule={feeSchedule} isFetching={false} />
    </QueryClientProvider>
  );
};

describe('PayerAssociations employer gating', () => {
  beforeEach(() => {
    listEmployersMock.mockReset();
    listEmployersMock.mockResolvedValue([employerOrg]);
  });

  it('never loads legacy employers when non-insurance organizations are on', async () => {
    flags.nio = true;

    renderPayerAssociations();

    // Insurance associations still resolve and render.
    expect(await screen.findByText('Aetna Better Health')).toBeInTheDocument();
    expect(listEmployersMock).not.toHaveBeenCalled();
  });

  it('still loads legacy employers when non-insurance organizations are off', async () => {
    flags.nio = false;

    renderPayerAssociations();

    await waitFor(() => expect(listEmployersMock).toHaveBeenCalled());
  });
});
