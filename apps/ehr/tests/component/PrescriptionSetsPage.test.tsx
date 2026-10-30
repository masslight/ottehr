import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PrescriptionQuickPickData, PrescriptionSetQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrescriptionSetsPage from '../../src/features/visits/telemed/components/admin/PrescriptionSetsPage';

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args) }));

const api = vi.hoisted(() => ({
  getPrescriptionQuickPicks: vi.fn(),
  getPrescriptionSetQuickPicks: vi.fn(),
  createPrescriptionSetQuickPick: vi.fn(),
  updatePrescriptionSetQuickPick: vi.fn(),
  removeQuickPick: vi.fn(),
}));
vi.mock('src/api/api', async (importOriginal) => ({ ...(await importOriginal<object>()), ...api }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: undefined }) }));

const AMOX: PrescriptionQuickPickData = {
  id: 'qp-amox',
  name: 'Amox otitis',
  ndc: '00093416173',
  medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
  dosing: { rate: 45, basis: 'mg/kg/day', frequency: 'twice daily', durationDays: 10 },
};
const IBUPROFEN: PrescriptionQuickPickData = {
  id: 'qp-ibu',
  name: 'Ibuprofen pain',
  ndc: '00904585354',
  medicationDescription: 'Ibuprofen 100 mg/5ml Susp',
  patientInstructions: 'Take 5 mL by mouth every 6 hours as needed for pain.',
};
const DROPS: PrescriptionQuickPickData = {
  id: 'qp-drops',
  name: 'Ofloxacin drops',
  ndc: '60758014510',
  medicationDescription: 'Ofloxacin 0.3% Soln',
  patientInstructions: 'Put 5 drops in the affected ear twice daily for 7 days.',
};
const EAR_INFECTION: PrescriptionSetQuickPickData = {
  id: 'set-1',
  name: 'Ear infection',
  status: 'Active',
  memberIds: ['qp-amox', 'qp-ibu'],
};
const REMOVED_AT = '2026-10-27T14:00:00.000Z';
const STREP: PrescriptionSetQuickPickData = {
  id: 'set-2',
  name: 'Strep throat',
  status: 'Inactive',
  memberIds: ['qp-ibu'],
  removedMembers: [{ name: 'Penicillin VK', removedAt: REMOVED_AT }],
};

const renderPage = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  render(<PrescriptionSetsPage />, { wrapper: Wrapper });
};

const addMember = async (
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  name: string
): Promise<void> => {
  await user.type(within(dialog).getByRole('combobox', { name: 'Add a prescription quick pick' }), name.slice(0, 3));
  await user.click(await screen.findByRole('option', { name: new RegExp(name) }));
};

const memberNames = (dialog: HTMLElement): string[] =>
  within(dialog)
    .queryAllByTestId('prescription-set-member')
    .map((member) => member.querySelector('p')?.textContent ?? '');

describe('Prescription sets admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getPrescriptionQuickPicks.mockResolvedValue({ quickPicks: [AMOX, IBUPROFEN, DROPS] });
    api.getPrescriptionSetQuickPicks.mockResolvedValue({ quickPicks: [EAR_INFECTION, STREP] });
    api.createPrescriptionSetQuickPick.mockResolvedValue({ quickPick: { id: 'new' } });
    api.updatePrescriptionSetQuickPick.mockResolvedValue({ quickPick: { id: 'set-1' } });
    api.removeQuickPick.mockResolvedValue(undefined);
  });

  it('lists each set with its prescriptions one per line, its status and the note of a removed quick pick', async () => {
    renderPage();
    const row = (await screen.findByText('Ear infection')).closest('tr') as HTMLElement;
    const cells = within(row).getAllByRole('cell');
    expect(Array.from(cells[1].children).map((line) => line.textContent)).toEqual(['Amox otitis', 'Ibuprofen pain']);
    expect(within(row).getByText('Active')).toBeInTheDocument();
    const strep = screen.getByText('Strep throat').closest('tr') as HTMLElement;
    expect(within(strep).getByText('Inactive')).toBeInTheDocument();
    const date = DateTime.fromISO(REMOVED_AT).toLocaleString(DateTime.DATE_SHORT);
    expect(within(strep).getByText(`Penicillin VK was removed (${date})`)).toBeInTheDocument();
  });

  it('adds a set from existing quick picks, in the order added, Active unless changed', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Otitis externa');
    await addMember(user, dialog, 'Ofloxacin drops');
    // Already in the set: not offered again.
    await user.type(within(dialog).getByRole('combobox', { name: 'Add a prescription quick pick' }), 'Ofl');
    expect(screen.queryByRole('option', { name: /Ofloxacin drops/ })).not.toBeInTheDocument();
    await user.clear(within(dialog).getByRole('combobox', { name: 'Add a prescription quick pick' }));
    await addMember(user, dialog, 'Ibuprofen pain');
    expect(memberNames(dialog)).toEqual(['Ofloxacin drops', 'Ibuprofen pain']);
    const drops = within(dialog).getAllByTestId('prescription-set-member')[0];
    expect(within(drops).getByText('Ofloxacin 0.3% Soln')).toBeInTheDocument();
    expect(within(drops).getByText(DROPS.patientInstructions!)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(api.createPrescriptionSetQuickPick).toHaveBeenCalledWith(
        {},
        { quickPick: { name: 'Otitis externa', status: 'Active', memberIds: ['qp-drops', 'qp-ibu'] } }
      )
    );
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Prescription set created', { variant: 'success' });
  });

  it('wants a name and at least one quick pick', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Add at least one prescription quick pick')).toBeInTheDocument();
    expect(api.createPrescriptionSetQuickPick).not.toHaveBeenCalled();
  });

  it('won’t add a set with another set’s name, trimmed and in any case', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Name/), ' ear INFECTION ');
    await addMember(user, dialog, 'Ofloxacin drops');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByText('A prescription set named "ear INFECTION" already exists')).toBeInTheDocument();
    expect(api.createPrescriptionSetQuickPick).not.toHaveBeenCalled();
  });

  it('won’t rename a set to another set’s name, and shows the server’s error if it finds one', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Strep throat')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Edit'));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, 'Ear infection');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('A prescription set named "Ear infection" already exists')).toBeInTheDocument();
    expect(api.updatePrescriptionSetQuickPick).not.toHaveBeenCalled();
    // A set saved elsewhere since the list loaded: the server's check is the last word.
    api.updatePrescriptionSetQuickPick.mockRejectedValue({
      code: 4000,
      message: 'A prescription set named "Sore throat" already exists',
    });
    await user.clear(name);
    await user.type(name, 'Sore throat');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('A prescription set named "Sore throat" already exists', {
        variant: 'error',
      })
    );
  });

  it('edits a set: reorders, removes a quick pick, changes the status; saving clears the removal note', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Strep throat')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Edit'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Inactive')).toBeChecked();
    await addMember(user, dialog, 'Amox otitis');
    await addMember(user, dialog, 'Ofloxacin drops');
    expect(memberNames(dialog)).toEqual(['Ibuprofen pain', 'Amox otitis', 'Ofloxacin drops']);
    expect(within(dialog).getByRole('button', { name: 'Move Ibuprofen pain up' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Move Ofloxacin drops down' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Move Amox otitis up' }));
    expect(memberNames(dialog)).toEqual(['Amox otitis', 'Ibuprofen pain', 'Ofloxacin drops']);
    await user.click(within(dialog).getByRole('button', { name: 'Move Amox otitis down' }));
    expect(memberNames(dialog)).toEqual(['Ibuprofen pain', 'Amox otitis', 'Ofloxacin drops']);
    await user.click(within(dialog).getByRole('button', { name: 'Remove Ofloxacin drops' }));
    await user.click(within(dialog).getByLabelText('Active'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.updatePrescriptionSetQuickPick).toHaveBeenCalledWith({}, 'set-2', {
        name: 'Strep throat',
        status: 'Active',
        memberIds: ['qp-ibu', 'qp-amox'],
      })
    );
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Prescription set updated', { variant: 'success' });
  });

  it('removes a set only after the confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Ear infection')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Remove'));
    const confirm = await screen.findByRole('dialog');
    expect(within(confirm).getByText('Remove Prescription Set "Ear infection"?')).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.removeQuickPick).toHaveBeenCalledWith({}, 'set-1'));
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Prescription set removed', { variant: 'success' });
  });
});
