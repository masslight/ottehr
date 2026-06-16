import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimsList from '../../src/pages/ClaimsList';
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

describe('ClaimsList', () => {
  beforeEach(() => {
    executeMock.mockReset();
    executeMock.mockImplementation(async ({ id }: { id: string }) => {
      if (id === 'search-billing-claims') {
        return {
          output: {
            claims: [],
            total: 0,
            offset: 0,
            pageSize: 25,
          },
        };
      }
      if (id === 'search-billing-tags') {
        return {
          output: {
            tags: [],
          },
        };
      }
      return { output: {} };
    });
  });

  it('searches claims and loads tags via the api on mount', async () => {
    renderWithProviders(<ClaimsList />);

    expect(screen.getByText('Claims')).toBeTruthy();
    await waitFor(() =>
      expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'search-billing-claims' }))
    );
    await waitFor(() =>
      expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'search-billing-tags' }))
    );
  });
});
