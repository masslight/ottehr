import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ErxEventDTO, PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionTable } from '../../src/features/visits/in-person/components/erx/PrescriptionTable';

const SENT = '2026-10-27T15:00:30.000Z';
const ordered = { code: 'ordered', recorded: SENT };
const accepted = { code: 'accepted', recorded: '2026-10-27T15:01:00.000Z' };
const prescription = (
  resourceId: string,
  name: string,
  status: PrescribedMedicationDTO['status'],
  events: ErxEventDTO[] = [ordered, accepted]
): PrescribedMedicationDTO => ({
  resourceId,
  name,
  status,
  instructions: `Directions for ${name}`,
  pharmacyName: 'Apex Discount Drugs',
  added: '2026-10-28T09:00:00.000Z',
  sent: SENT,
  events,
});
const AMOX = prescription('mr-amox', 'Amoxicillin 400 mg/5ml Susp', 'active');
const IBU = prescription('mr-ibu', 'Ibuprofen 100 mg/5ml Susp', 'active');
const PRED = prescription('mr-pred', 'Prednisolone 15 mg/5ml Sol', 'active', [
  ordered,
  accepted,
  { code: 'cancelrequested', text: 'Cancellation requested with reason: Sent in error', recorded: SENT },
]);
const ONDANSETRON = prescription('mr-ond', 'Ondansetron 4 mg/5ml Sol', 'draft', [ordered]);

const mocks = vi.hoisted(() => ({ refetch: vi.fn(), fetch: vi.fn() }));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ profileResource: { id: 'practitioner-1' } }) }));
vi.mock('../../src/features/visits/shared/hooks/useChartSection', () => ({
  useChartSection: () => ({
    isLoading: false,
    isFetching: false,
    data: { prescribedMedications: [AMOX, IBU, PRED, ONDANSETRON], prescribedMedicationsRequesterPractitioners: [] },
    refetch: mocks.refetch,
  }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ appointment: { start: '2026-10-27T14:00:00.000Z' } }),
}));

const renderTable = (): ReturnType<typeof userEvent.setup> => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PrescriptionTable />
    </QueryClientProvider>
  );
  return user;
};
const row = (name: string): HTMLElement => screen.getByText(name).closest('tr')!;
const response = (status: number, body: unknown): Response =>
  ({ ok: status < 300, status, json: async () => body }) as Response;

const cancelBothWithReason = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('checkbox', { name: 'Select all cancellable prescriptions' }));
  await user.click(screen.getByRole('button', { name: 'Cancel prescriptions…' }));
  await user.click(screen.getByRole('combobox', { name: /Reason/ }));
  await user.click(screen.getByRole('option', { name: 'Patient request' }));
  await user.click(screen.getByRole('button', { name: 'Send cancellation' }));
};

describe('Prescription table: cancel eRx prescriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockResolvedValue(response(200, { messageId: 'm' }));
    mocks.refetch.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows when each prescription was sent, and its status with the latest event', () => {
    renderTable();
    const sent = formatDateToMDYWithTime(SENT, DateTime.local().zoneName)!;
    const orderAdded = row(AMOX.name!).querySelectorAll('td')[5];
    expect(orderAdded).toHaveTextContent(`${sent.date}${sent.time}`);
    expect(within(row(AMOX.name!)).getByText('Sent')).toBeInTheDocument();
    expect(within(row(PRED.name!)).getByText('Cancel requested')).toBeInTheDocument();
    expect(within(row(PRED.name!)).getByText('Sent in error · waiting for the pharmacy')).toBeInTheDocument();
    expect(within(row(ONDANSETRON.name!)).getByText('Sending')).toBeInTheDocument();
    expect(within(row(ONDANSETRON.name!)).getByText('Waiting for Surescripts')).toBeInTheDocument();
  });

  it('offers to cancel only a cancellable prescription from its menu', async () => {
    const user = renderTable();
    await user.click(within(row(PRED.name!)).getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Cancel prescription…' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    await user.click(within(row(AMOX.name!)).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel prescription…' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Cancel prescription')).toBeInTheDocument();
    expect(within(dialog).getByText(AMOX.name!)).toBeInTheDocument();
    expect(within(dialog).getByText(AMOX.instructions!)).toBeInTheDocument();
    expect(within(dialog).getByText(/^Apex Discount Drugs · Sent /)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Keep prescription' })).toBeInTheDocument();
  });

  it('checks only cancellable rows, and the header checks all of them', async () => {
    const user = renderTable();
    expect(within(row(PRED.name!)).getByRole('checkbox')).toBeDisabled();
    expect(within(row(ONDANSETRON.name!)).getByRole('checkbox')).toBeDisabled();
    await user.click(within(row(AMOX.name!)).getByRole('checkbox'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select all cancellable prescriptions' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(within(row(IBU.name!)).getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it('needs a reason before it sends a cancellation', async () => {
    const user = renderTable();
    await user.click(screen.getByRole('checkbox', { name: 'Select all cancellable prescriptions' }));
    await user.click(screen.getByRole('button', { name: 'Cancel prescriptions…' }));
    expect(within(screen.getByRole('dialog')).getByText('Cancel 2 prescriptions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send cancellation' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep prescriptions' })).toBeInTheDocument();
  });

  it('sends one cancellation per prescription, then refetches and clears the selection', async () => {
    const user = renderTable();
    await cancelBothWithReason(user);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toMatch(/\/v4\/cancel-prescription$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer user-token');
    expect(mocks.fetch.mock.calls.map((call) => JSON.parse(call[1].body))).toEqual([
      { medicationRequestId: AMOX.resourceId, practitionerId: 'practitioner-1', reason: 'Patient request' },
      { medicationRequestId: IBU.resourceId, practitionerId: 'practitioner-1', reason: 'Patient request' },
    ]);
    expect(enqueueSnackbar).toHaveBeenCalledWith('2 cancellations sent', { variant: 'success' });
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the prescriptions whose cancellation failed, with the service message', async () => {
    mocks.fetch
      .mockResolvedValueOnce(response(200, { messageId: 'm' }))
      .mockResolvedValueOnce(response(400, { message: 'Cancellation already requested' }));
    const user = renderTable();
    await cancelBothWithReason(user);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      `1 of 2 cancellations sent. ${IBU.name}: Cancellation already requested`,
      { variant: 'error' }
    );
  });
});
