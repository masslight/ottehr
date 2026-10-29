import { DataGridProProps } from '@mui/x-data-grid-pro';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionTable } from '../../src/features/visits/in-person/components/erx/PrescriptionTable';

// A compound as the prescriptions DTO reads it from the MedicationRequest's contained Medication: each ingredient as
// the amount that went in.
const CREAM: PrescribedMedicationDTO = {
  resourceId: 'mr-cream',
  name: 'Pain cream',
  status: 'active',
  provider: 'practitioner-1',
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
      dosageForm: 'Cream',
      ingredients: [
        { description: 'Ketoprofen Powder', ndc: '00000000001', amount: { value: 6, unit: 'Gram' } },
        { description: 'Lidocaine', amount: { value: 600, unit: 'Milligram' } },
        { description: 'Compounding cream', amount: { value: 53.4, unit: 'Gram' } },
      ],
    },
  },
};
// The same compound, but Surescripts errored: sending it again cancels nothing.
const CREAM_ERRORED: PrescribedMedicationDTO = {
  ...CREAM,
  resourceId: 'mr-cream-errored',
  name: 'Errored cream',
  status: 'stopped',
  events: [{ code: 'ordered', recorded: '2026-10-28T11:00:00.000Z' }],
  order: { ...CREAM.order, compound: { ...CREAM.order!.compound!, description: 'Errored cream' } },
};
// An errored compound whose second ingredient's amount and dosage form couldn't be read.
const RINSE_UNREADABLE: PrescribedMedicationDTO = {
  ...CREAM_ERRORED,
  resourceId: 'mr-rinse',
  name: 'Mouth rinse',
  sent: '2026-10-28T10:00:00.000Z',
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
// Google and the Surescripts directory find the sample pharmacies.
vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', async () => {
  const { searchSamplePlaces } = await import('./helpers/samplePharmacies');
  return { useOystehrAPIClient: () => ({ searchPlaces: searchSamplePlaces }) };
});
vi.mock('src/api/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/api/api')>()),
  searchPharmacyDirectory: (await import('./helpers/samplePharmacies')).searchSampleDirectory,
}));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ profileResource: { id: 'practitioner-1' } }) }));
vi.mock('../../src/features/visits/shared/hooks/useChartSection', () => ({
  useChartSection: () => ({
    isLoading: false,
    isFetching: false,
    data: {
      prescribedMedications: [CREAM, CREAM_ERRORED, RINSE_UNREADABLE],
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
  expect(await within(dialog).findByText(/Send to Sample Pharmacy Two/)).toBeInTheDocument();
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

  it('shows a compound as its name with its dosage form and ingredient amounts underneath', () => {
    renderTable();
    const cell = screen.getByText('Compound: Pain cream');
    expect(cell).toHaveTextContent(
      'Compound: Pain creamCream · Ketoprofen Powder 6 grams · Lidocaine 600 milligrams · Compounding cream 53.4 grams'
    );
    expect(within(cell).getByText(/^Cream · Ketoprofen Powder/)).toHaveClass('MuiTypography-caption');
  });

  it('shows a compound’s details with its ingredients, and the prescriber', async () => {
    const user = renderTable();
    await user.click(within(row('Compound: Pain cream')).getByRole('button', { name: 'Details' }));
    const details = screen.getByRole('dialog').querySelector('dl')!;
    expect(details).toHaveTextContent(
      'MedicationCompound: Pain cream · Cream · Ketoprofen Powder 6 grams · Lidocaine 600 milligrams · Compounding cream 53.4 grams'
    );
    expect(details).toHaveTextContent('Quantity60 gramsDays supply30Refills0Pharmacy');
    expect(details).toHaveTextContent('PrescriberAbrams, Dana');
  });

  it('disables Cancel on a sent compound, and sending it elsewhere (which cancels it first)', async () => {
    const user = renderTable();
    for (const label of ['Cancel prescription', 'Send to another pharmacy']) {
      const button = within(row('Compound: Pain cream')).getByRole('button', { name: label });
      expect(button).toBeDisabled();
      await user.hover(button.parentElement!);
      expect((await screen.findByRole('tooltip')).textContent).toBe("Canceling compounds isn't supported yet");
      await user.unhover(button.parentElement!);
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    }
    // With no action left, it can't be selected for the bar's buttons either.
    expect(within(row('Compound: Pain cream')).getByRole('checkbox')).toBeDisabled();
  });

  it('sends an errored compound to another pharmacy again, every ingredient as its amount', async () => {
    const user = renderTable();
    await user.click(within(row('Compound: Errored cream')).getByRole('button', { name: 'Send to another pharmacy' }));
    await pickPharmacyAndSend(user);
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(calls('/v4/cancel-prescription')).toEqual([]);
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
        medicationDescription: 'Errored cream',
        substitutionAllowed: false,
        compound: {
          dosageForm: 'Cream',
          ingredients: [
            { description: 'Ketoprofen Powder', ndc: '00000000001', quantityValue: 6, quantityUnit: 'Gram' },
            { description: 'Lidocaine', quantityValue: 600, quantityUnit: 'Milligram' },
            { description: 'Compounding cream', quantityValue: 53.4, quantityUnit: 'Gram' },
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
      "Send to another pharmacy isn't available for Mouth rinse: missing dosage form, ingredient 2 amount."
    );
  });
});
