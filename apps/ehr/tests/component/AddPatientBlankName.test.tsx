import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPatient } from '../../src/api/api';
import { dataTestIds } from '../../src/constants/data-test-ids';
import AddPatient from '../../src/pages/AddPatient';

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: vi.fn(),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
  closeSnackbar: vi.fn(),
}));

vi.mock('../../src/api/api', async () => ({
  ...(await vi.importActual('../../src/api/api')),
  createPatient: vi.fn(),
  listServiceCategories: vi.fn().mockResolvedValue({ serviceCategories: [] }),
}));

const mockApiClients = {
  oystehr: {
    fhir: {
      search: vi.fn().mockResolvedValue({ entry: [], total: 0, unbundle: () => [] }),
    },
  },
  oystehrZambda: {},
};
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => mockApiClients,
}));

const renderAddPatient = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/patients/add']}>
        <AddPatient patientOnly />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const enterNewPatient = async (
  user: ReturnType<typeof userEvent.setup>,
  firstName: string,
  lastName: string
): Promise<void> => {
  const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');
  await user.click(phoneNumberInput!);
  await user.paste('2025550143');
  await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));
  const notFoundButton = await screen.findByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
  await user.click(notFoundButton);
  await waitForElementToBeRemoved(notFoundButton);

  await user.click(screen.getByTestId(dataTestIds.addPatientPage.firstNameInput).querySelector('input')!);
  await user.paste(firstName);
  await user.click(screen.getByTestId(dataTestIds.addPatientPage.lastNameInput).querySelector('input')!);
  await user.paste(lastName);
  await user.click(await screen.findByPlaceholderText('MM/DD/YYYY'));
  await user.paste('01/01/2000');
  await user.click(
    screen.getByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown).querySelector('[role="combobox"]')!
  );
  await user.click(await screen.findByText('Male'));
};

describe('Add Patient: blank names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(vi.fn());
  });

  it.each([
    ['first', '   ', 'Doe', 'First name is required'],
    ['last', 'John', '  ', 'Last name is required'],
  ])(
    'flags a whitespace-only %s name and does not submit it',
    async (_which, firstName, lastName, message) => {
      const user = userEvent.setup();
      renderAddPatient();
      await enterNewPatient(user, firstName, lastName);

      await user.click(screen.getByTestId(dataTestIds.addPatientPage.addButton));

      expect(await screen.findByText(message)).toBeVisible();
      expect(createPatient).not.toHaveBeenCalled();
    },
    15000
  );

  it('still submits names that have surrounding spaces', async () => {
    vi.mocked(createPatient).mockResolvedValue({ patientId: 'new-patient' });
    const user = userEvent.setup();
    renderAddPatient();
    await enterNewPatient(user, ' John', 'Doe ');

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.addButton));

    await waitFor(() => expect(createPatient).toHaveBeenCalledTimes(1));
  }, 15000);
});
