import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PatientsList from '../../src/pages/PatientsList';
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

describe('PatientsList', () => {
  beforeEach(() => {
    executeMock.mockReset();
    executeMock.mockResolvedValue({
      output: {
        patients: [
          {
            id: 'p1',
            name: 'Doe, Jane',
            firstName: 'Jane',
            lastName: 'Doe',
            dob: '1990-01-01',
            gender: 'female',
            friendlyId: 'F1',
            address: '123 Main St',
          },
        ],
        total: 1,
        offset: 0,
        pageSize: 25,
      },
    });
  });

  it('searches patients via the api on mount and shows the result count', async () => {
    renderWithProviders(<PatientsList />);

    expect(screen.getByText('Patients')).toBeTruthy();
    await waitFor(() =>
      expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'search-billing-patients' }))
    );
    expect(await screen.findByText('1 total')).toBeTruthy();
  });
});
