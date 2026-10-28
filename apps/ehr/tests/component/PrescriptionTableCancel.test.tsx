import { DataGridProProps } from '@mui/x-data-grid-pro';
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
const VISIT_START = '2026-10-27T14:00:00.000Z';
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
const IBU = { ...prescription('mr-ibu', 'Ibuprofen 100 mg/5ml Susp', 'active'), sent: '2026-10-28T10:00:00.000Z' };
const PRED = prescription('mr-pred', 'Prednisolone 15 mg/5ml Sol', 'active', [
  ordered,
  accepted,
  { code: 'cancelrequested', text: 'Cancellation requested with reason: Sent in error', recorded: SENT },
]);
const ONDANSETRON = prescription('mr-ond', 'Ondansetron 4 mg/5ml Sol', 'draft', [ordered]);

const mocks = vi.hoisted(() => ({ refetch: vi.fn(), fetch: vi.fn() }));

// jsdom measures nothing, so the grid's virtualization would render no rows.
vi.mock('@mui/x-data-grid-pro', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mui/x-data-grid-pro')>();
  return {
    ...actual,
    DataGridPro: (props: DataGridProProps) => <actual.DataGridPro {...props} disableVirtualization />,
  };
});
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
  useAppointmentData: () => ({ appointment: { start: VISIT_START } }),
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
const row = (name: string): HTMLElement => screen.getByText(name).closest<HTMLElement>('[role="row"]')!;
const checkbox = (name: string): HTMLElement => within(row(name)).getByRole('checkbox', { hidden: true });
const selectAll = (): HTMLElement => screen.getByRole('checkbox', { name: 'Select all rows' });
const response = (status: number, body: unknown): Response =>
  ({ ok: status < 300, status, json: async () => body }) as Response;

const cancelBothWithReason = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(selectAll());
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

  it('shows each prescription’s status, newest sent first, without SIG or order added', () => {
    renderTable();
    expect(screen.queryByRole('columnheader', { name: 'Patient instructions (SIG)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Order added' })).not.toBeInTheDocument();
    expect(screen.queryByText(AMOX.instructions!)).not.toBeInTheDocument();
    const names = [AMOX, IBU, PRED, ONDANSETRON].map((item) => item.name!);
    const order = screen
      .getAllByRole('row')
      .flatMap((element) => names.filter((name) => element.textContent?.includes(name)));
    expect(order[0]).toBe(IBU.name);
    expect(within(row(AMOX.name!)).getByText('Sent')).toBeInTheDocument();
    // The visit's date only, in the browser's timezone
    const visit = formatDateToMDYWithTime(VISIT_START, DateTime.local().zoneName)!;
    expect(within(row(AMOX.name!)).getByText(visit.date)).toBeInTheDocument();
    expect(within(row(AMOX.name!)).queryByText(visit.time)).not.toBeInTheDocument();
    expect(within(row(PRED.name!)).getByText('Cancel requested')).toBeInTheDocument();
    expect(within(row(ONDANSETRON.name!)).getByText('Sending')).toBeInTheDocument();
    expect(screen.queryByText('Sent in error · waiting for the pharmacy')).not.toBeInTheDocument();
    // Four rows fit on one page.
    expect(screen.queryByText(/1–4 of 4/)).not.toBeInTheDocument();
  });

  it('shows the latest event when the status chip is hovered, and to screen readers', async () => {
    const user = renderTable();
    const chip = within(row(PRED.name!)).getByText('Cancel requested').closest('.MuiChip-root')!.parentElement!;
    expect(chip).toHaveAccessibleDescription('Sent in error · waiting for the pharmacy');
    await user.hover(within(row(PRED.name!)).getByText('Cancel requested'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Sent in error · waiting for the pharmacy');
    expect(chip).toHaveAccessibleDescription('Sent in error · waiting for the pharmacy');
    await user.unhover(within(row(PRED.name!)).getByText('Cancel requested'));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    await user.hover(within(row(ONDANSETRON.name!)).getByText('Sending'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Waiting for Surescripts');
  });

  it('gives a chip with no latest event no tooltip', async () => {
    const user = renderTable();
    await user.hover(within(row(AMOX.name!)).getByText('Sent'));
    // Past the tooltip's enter delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
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
    const sent = formatDateToMDYWithTime(SENT, DateTime.local().zoneName)!;
    expect(within(dialog).getByText(`Apex Discount Drugs · Sent ${sent.date} ${sent.time}`)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Keep prescription' })).toBeInTheDocument();
  });

  it('keeps the selection bar in place with nothing selected, its action disabled', () => {
    renderTable();
    expect(screen.getByRole('button', { name: 'Cancel prescriptions…' })).toBeDisabled();
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('selects only cancellable rows, and the header selects all of them', async () => {
    const user = renderTable();
    expect(checkbox(PRED.name!)).toBeDisabled();
    expect(checkbox(ONDANSETRON.name!)).toBeDisabled();
    await user.click(checkbox(AMOX.name!));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    // The grid's header checkbox clears a partial selection, then selects every selectable row.
    await user.click(screen.getByRole('checkbox', { name: 'Unselect all rows' }));
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
    await user.click(selectAll());
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(checkbox(IBU.name!)).toBeChecked();
    expect(checkbox(PRED.name!)).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Cancel prescriptions…' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel prescriptions…' })).toBeDisabled();
  });

  it('a click anywhere on a cancellable row selects it, and again deselects it', async () => {
    const user = renderTable();
    expect(row(AMOX.name!)).toHaveClass('selectable');
    await user.click(screen.getByText(AMOX.name!));
    expect(checkbox(AMOX.name!)).toBeChecked();
    await user.click(screen.getByText(IBU.name!));
    // Another row adds to the selection.
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await user.click(within(row(AMOX.name!)).getByText('Sent'));
    expect(checkbox(AMOX.name!)).not.toBeChecked();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('does not select from the menu, nor a row that cannot be cancelled', async () => {
    const user = renderTable();
    await user.click(within(row(AMOX.name!)).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel prescription…' }));
    await user.click(screen.getByRole('button', { name: 'Keep prescription' }));
    expect(checkbox(AMOX.name!)).not.toBeChecked();
    expect(row(PRED.name!)).not.toHaveClass('selectable');
    await user.click(screen.getByText(PRED.name!));
    expect(checkbox(PRED.name!)).not.toBeChecked();
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it('needs a reason before it sends a cancellation', async () => {
    const user = renderTable();
    await user.click(selectAll());
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
      { medicationRequestId: IBU.resourceId, practitionerId: 'practitioner-1', reason: 'Patient request' },
      { medicationRequestId: AMOX.resourceId, practitionerId: 'practitioner-1', reason: 'Patient request' },
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
      `1 of 2 cancellations sent. ${AMOX.name}: Cancellation already requested`,
      { variant: 'error' }
    );
  });
});
