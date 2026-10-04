import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
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

const existingPatient = {
  resourceType: 'Patient',
  id: 'existing-patient',
  name: [{ given: ['Jane'], family: 'Doe' }],
  birthDate: '2001-02-03',
  gender: 'female',
};

// Hoisted to module scope so useApiClients returns the same references on every render (see AddVisit.test.tsx).
const mockApiClients = {
  oystehr: {
    fhir: {
      search: vi.fn().mockResolvedValue({ entry: [], total: 0, unbundle: () => [] }),
      get: vi.fn().mockResolvedValue(existingPatient),
    },
  },
  oystehrZambda: {},
};
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => mockApiClients,
}));

// App.tsx renders <AddPatient patientOnly /> at /patients/add and <AddPatient /> at /visits/add.
const renderAt = (url: string): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <AddPatient patientOnly={url.startsWith('/patients/add')} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const enterNewPatient = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const phoneNumberInput = screen.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).querySelector('input');
  await user.click(phoneNumberInput!);
  await user.paste('2025550143');
  await user.click(screen.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton));
  const notFoundButton = await screen.findByTestId(dataTestIds.addPatientPage.patientNotFoundButton);
  await user.click(notFoundButton);
  await waitForElementToBeRemoved(notFoundButton);

  await user.click(screen.getByTestId(dataTestIds.addPatientPage.firstNameInput).querySelector('input')!);
  await user.paste('John');
  await user.click(screen.getByTestId(dataTestIds.addPatientPage.lastNameInput).querySelector('input')!);
  await user.paste('Doe');
  await user.click(await screen.findByPlaceholderText('MM/DD/YYYY'));
  await user.paste('01/01/2000');
  await user.click(
    screen.getByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown).querySelector('[role="combobox"]')!
  );
  await user.click(await screen.findByText('Male'));
};

describe('Add Patient: a patient without a visit', () => {
  const navigateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);
  });

  it('leaves Add Visit as it was: the visit fields, and a visit to add', () => {
    renderAt('/visits/add');

    expect(screen.getByTestId(dataTestIds.addPatientPage.pageTitle)).toHaveTextContent('Add Visit');
    expect(screen.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.addPatientPage.bookableSelect)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.addPatientPage.addButton)).not.toHaveTextContent('Add patient');
  });

  it('shows no visit fields on Add Patient, and Cancel goes back to Patients', async () => {
    const user = userEvent.setup();
    renderAt('/patients/add');

    expect(screen.getByTestId(dataTestIds.addPatientPage.pageTitle)).toHaveTextContent('Add Patient');
    expect(screen.queryByTestId(dataTestIds.addPatientPage.visitTypeDropdown)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.addPatientPage.serviceCategoryDropdown)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.addPatientPage.bookableSelect)).not.toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.addPatientPage.addButton)).toHaveTextContent('Add patient');

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.cancelButton));
    expect(navigateMock).toHaveBeenCalledWith('/patients');
  });

  it('still asks staff to search before adding', async () => {
    const user = userEvent.setup();
    renderAt('/patients/add');

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.addButton));

    expect(screen.getByText('Please search for patients before adding')).toBeVisible();
    expect(createPatient).not.toHaveBeenCalled();
  });

  it('creates the patient without any visit details and lands on their information page', async () => {
    vi.mocked(createPatient).mockResolvedValue({ patientId: 'new-patient' });
    const user = userEvent.setup();
    renderAt('/patients/add');

    await enterNewPatient(user);

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.addButton));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/patient/new-patient/info'));
    expect(createPatient).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createPatient).mock.calls[0][1]).toEqual({
      patient: expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '2000-01-01',
        sex: 'male',
        phoneNumber: '2025550143',
      }),
    });
  }, 10000);

  it('creates nothing for a patient who already exists and opens their record instead', async () => {
    const user = userEvent.setup();
    renderAt('/patients/add?patientId=existing-patient');

    const button = screen.getByTestId(dataTestIds.addPatientPage.addButton);
    await waitFor(() => expect(button).toHaveTextContent('Open patient record'));
    await user.click(button);

    expect(navigateMock).toHaveBeenCalledWith('/patient/existing-patient');
    expect(createPatient).not.toHaveBeenCalled();
  });

  it('opens the record of an existing patient even when their sex and date of birth are missing', async () => {
    mockApiClients.oystehr.fhir.get.mockResolvedValueOnce({
      ...existingPatient,
      gender: undefined,
      birthDate: undefined,
    });
    const user = userEvent.setup();
    renderAt('/patients/add?patientId=existing-patient');

    const button = screen.getByTestId(dataTestIds.addPatientPage.addButton);
    await waitFor(() => expect(button).toHaveTextContent('Open patient record'));
    await user.click(button);

    expect(navigateMock).toHaveBeenCalledWith('/patient/existing-patient');
  });

  it('shows the reason when the server rejects the details', async () => {
    vi.mocked(createPatient).mockRejectedValue({ code: 4340, message: 'First name is required' });
    const user = userEvent.setup();
    renderAt('/patients/add');
    await enterNewPatient(user);

    await user.click(screen.getByTestId(dataTestIds.addPatientPage.addButton));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith('First name is required', { variant: 'error' }));
    expect(navigateMock).not.toHaveBeenCalled();
  }, 10000);
});
