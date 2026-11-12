import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditPatientDialog from '../../src/components/dialogs/EditPatientDialog';

const storedPatient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [
    { use: 'official', given: ['John', 'Quincy'], family: 'Doe' },
    { use: 'nickname', given: ['Johnny'] },
  ],
  birthDate: '2000-01-01',
  telecom: [
    { system: 'phone', rank: 1, value: '2025550143' },
    { system: 'email', rank: 1, value: 'john@example.com' },
  ],
  address: [{ line: ['1 Main St', 'Apt 2'], city: 'Springfield', state: 'NY', postalCode: '12345' }],
};

const patch = vi.fn();
const mockApiClients = { oystehr: { fhir: { patch } } };
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => mockApiClients,
}));

const appointmentData = { patient: storedPatient, appointmentSetState: vi.fn() };
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => appointmentData,
}));

const renderDialog = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EditPatientDialog modalOpen onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const replaceText = async (user: ReturnType<typeof userEvent.setup>, label: RegExp, text: string): Promise<void> => {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, text);
};

const patchedValue = (path: string): unknown =>
  patch.mock.calls[0][0].operations.find((op: { path: string }) => op.path === path)?.value;

describe('EditPatientDialog blank text', () => {
  beforeEach(() => {
    patch.mockReset();
    patch.mockResolvedValue(storedPatient);
  });

  it.each([/^First Name/, /^Last Name/])('disables Save and does not patch for a whitespace-only %s', async (label) => {
    const user = userEvent.setup();
    renderDialog();

    await replaceText(user, label, '   ');
    const save = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeDisabled());
    await act(async () => {
      fireEvent.submit(save.closest('form')!);
    });

    expect(patch).not.toHaveBeenCalled();
  });

  it('drops whitespace-only optional name and address parts and trims the rest', async () => {
    const user = userEvent.setup();
    renderDialog();

    await replaceText(user, /^First Name/, ' Jane ');
    await replaceText(user, /^Middle Name/, '   ');
    await replaceText(user, /^Preferred name/, '  ');
    await replaceText(user, /^Address 2/, '  ');
    await replaceText(user, /^City/, ' Shelbyville ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patchedValue('/name')).toEqual([{ use: 'official', family: 'Doe', given: ['Jane'] }]);
    expect(patchedValue('/address')).toEqual([
      { line: ['1 Main St'], city: 'Shelbyville', state: 'NY', postalCode: '12345' },
    ]);
  });
});
