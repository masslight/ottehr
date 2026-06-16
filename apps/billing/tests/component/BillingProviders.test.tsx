import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingProvidersList } from '../../src/pages/BillingProviders';
import { renderWithProviders } from './renderWithProviders';

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {
      zambda: {
        execute: executeMock,
      },
    },
  }),
}));

describe('BillingProvidersList', () => {
  beforeEach(() => {
    executeMock.mockReset();
    executeMock.mockResolvedValue({
      output: {
        providers: [],
        total: 0,
        offset: 0,
        pageSize: 25,
      },
    });
  });

  it('searches billing providers via the api on mount', async () => {
    renderWithProviders(<BillingProvidersList />);

    expect(screen.getByText('Billing Providers')).toBeTruthy();
    await waitFor(() =>
      expect(executeMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'search-billing-providers', providerType: 'billing' })
      )
    );
  });
});
