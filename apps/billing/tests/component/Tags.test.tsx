import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Tags from '../../src/pages/Tags';
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

describe('Tags', () => {
  beforeEach(() => {
    executeMock.mockReset();
    executeMock.mockResolvedValue({
      output: {
        tags: [
          {
            id: 't1',
            name: 'Overdue',
            description: 'Past due claims',
            usage: 3,
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
  });

  it('loads tags via the api on mount and renders them', async () => {
    renderWithProviders(<Tags />);

    expect(screen.getByText('Tags')).toBeTruthy();
    expect(await screen.findByText('Overdue')).toBeTruthy();
    expect(await screen.findByText('Past due claims')).toBeTruthy();
  });
});
