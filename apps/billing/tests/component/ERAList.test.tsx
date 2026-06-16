import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ERAList from '../../src/pages/ERAList';
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

describe('ERAList', () => {
  beforeEach(() => {
    executeMock.mockReset();
    executeMock.mockResolvedValue({
      output: {
        eras: [],
        total: 0,
        offset: 0,
        pageSize: 25,
      },
    });
  });

  it('searches ERAs via the api on mount', async () => {
    renderWithProviders(<ERAList />);

    expect(screen.getByText('ERAs')).toBeTruthy();
    await waitFor(() =>
      expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'search-billing-eras' }))
    );
  });
});
