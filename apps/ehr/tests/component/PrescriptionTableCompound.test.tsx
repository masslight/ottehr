import { DataGridProProps } from '@mui/x-data-grid-pro';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionTable } from '../../src/features/visits/in-person/components/erx/PrescriptionTable';

// A compound as the prescriptions DTO reads it from the MedicationRequest's contained Medication.
const CREAM: PrescribedMedicationDTO = {
  resourceId: 'mr-cream',
  name: 'Pain cream',
  status: 'active',
  instructions: 'Apply to the affected area three times daily.',
  pharmacyName: 'Apex Discount Drugs',
  encounterId: 'encounter-1',
  sent: '2026-10-28T12:00:00.000Z',
  events: [
    { code: 'ordered', recorded: '2026-10-28T12:00:00.000Z' },
    { code: 'accepted', recorded: '2026-10-28T12:00:30.000Z' },
  ],
  order: {
    patientId: 'patient-1',
    quantityValue: 60,
    quantityUnit: 'Gram',
    daysSupply: 30,
    numberOfRefills: 0,
    compound: {
      description: 'Pain cream',
      ingredients: [
        { description: 'Ketoprofen Powder', ndc: '00000000001', rxcui: '1001', strength: { value: 10, unit: '%' } },
        { description: 'Gabapentin Powder', ndc: '00000000002', amount: { value: 6, unit: 'Gram' } },
        { description: 'Compounding cream', base: true },
      ],
    },
  },
};
// One ingredient's measure couldn't be read.
const CREAM_UNREADABLE: PrescribedMedicationDTO = {
  ...CREAM,
  resourceId: 'mr-cream-2',
  name: 'Mouth rinse',
  order: {
    ...CREAM.order,
    compound: {
      description: 'Mouth rinse',
      ingredients: [CREAM.order!.compound!.ingredients[0], { description: 'Lidocaine' }],
    },
  },
};

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
    data: {
      prescribedMedications: [CREAM, CREAM_UNREADABLE],
      prescribedMedicationsRequesterPractitioners: [
        { resourceType: 'Practitioner', id: 'practitioner-1', name: [{ given: ['Dana'], family: 'Abrams' }] },
      ],
    },
    refetch: mocks.refetch,
  }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ appointment: { start: '2026-10-28T08:00:00.000Z' } }),
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
const response = (status: number, body: unknown): Response =>
  ({ ok: status < 300, status, json: async () => body }) as Response;
const calls = (path: string): unknown[] =>
  mocks.fetch.mock.calls.filter(([url]) => String(url).endsWith(path)).map((call) => JSON.parse(call[1].body));
const pickPharmacyAndSend = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button', { name: 'Send to pharmacy' })).toBeDisabled();
  await user.type(within(dialog).getByRole('combobox', { name: 'Pharmacy' }), 'Two');
  await user.click(await screen.findByRole('option', { name: /Sample Pharmacy Two/ }));
  expect(within(dialog).getByText(/Send to Sample Pharmacy Two/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Send to pharmacy' }));
};

describe('Prescription table: compounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockResolvedValue(response(200, { medicationRequestId: 'new', messageId: 'm', status: {} }));
    mocks.refetch.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows a compound as its name with its ingredients underneath', () => {
    renderTable();
    const cell = screen.getByText('Compound: Pain cream');
    expect(cell).toHaveTextContent(
      'Compound: Pain creamKetoprofen Powder 10% · Gabapentin Powder 6 grams · Compounding cream base'
    );
    expect(within(cell).getByText(/^Ketoprofen Powder 10%/)).toHaveClass('MuiTypography-caption');
  });

  it('sends a compound to another pharmacy as the same compound order', async () => {
    const user = renderTable();
    await user.click(within(row('Compound: Pain cream')).getByRole('button', { name: 'Send to another pharmacy' }));
    await pickPharmacyAndSend(user);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(calls('/v4/order-prescription')).toEqual([
      {
        patientId: 'patient-1',
        practitionerId: 'practitioner-1',
        encounterId: 'encounter-1',
        quantityValue: 60,
        quantityUnit: 'Gram',
        daysSupply: 30,
        writtenDate: DateTime.local().toISODate(),
        numberOfRefills: 0,
        patientInstructions: CREAM.instructions,
        pharmacyId: '0000031',
        pharmacyNpi: '1245319599',
        pharmacyName: 'Sample Pharmacy Two',
        pharmacyPhone: '5125550123',
        compound: {
          description: 'Pain cream',
          ingredients: [
            CREAM.order!.compound!.ingredients[0],
            CREAM.order!.compound!.ingredients[1],
            // Typed in when first sent, and confirmed not controlled then.
            { description: 'Compounding cream', base: true, typedNotControlled: true },
          ],
        },
      },
    ]);
  });

  it('disables sending a compound it cannot rebuild, naming what is missing', async () => {
    const user = renderTable();
    const send = within(row('Compound: Mouth rinse')).getByRole('button', { name: 'Send to another pharmacy' });
    expect(send).toBeDisabled();
    await user.hover(send.parentElement!);
    expect((await screen.findByRole('tooltip')).textContent).toBe(
      "Send to another pharmacy isn't available for Mouth rinse: missing ingredient 2 amount or strength."
    );
  });
});
