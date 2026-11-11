import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (must come before component imports) ─────────────────────────────

const { mockNavigate, mockCreateUpdateOrder, mockEnqueueSnackbar, patientBirthDate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCreateUpdateOrder: vi.fn(),
  mockEnqueueSnackbar: vi.fn(),
  patientBirthDate: { value: undefined as string | undefined },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'appt-1' }),
  };
});

vi.mock('notistack', () => ({
  enqueueSnackbar: mockEnqueueSnackbar,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({}),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => false, userName: 'Dr. Test' }),
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('../../src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    resources: {
      encounter: { id: 'enc-imm-codes' },
      patient: { id: 'pat-1', birthDate: patientBirthDate.value },
    },
  }),
}));

vi.mock('../../src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../../src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/components/BaseBreadcrumbs', () => ({
  BaseBreadcrumbs: () => <div />,
}));

vi.mock('../../src/components/dialogs/CustomDialog', () => ({
  CustomDialog: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/medication-administration/PageHeader', () => ({
  PageHeader: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/WarningBlock', () => ({
  WarningBlock: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/review-tab/components/AllergiesContainer', () => ({
  AllergiesContainer: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/review-tab/components/MedicationsContainer', () => ({
  MedicationsContainer: () => <div />,
}));

vi.mock('../../src/features/immunization/hooks/useImmunizationQuickPickManagement', () => ({
  useImmunizationQuickPickManagement: () => ({
    mergedQuickPicks: [],
    mergedQuickPicksLoading: false,
    quickPickDialogOpen: false,
    setQuickPickDialogOpen: vi.fn(),
    quickPickName: '',
    setQuickPickName: vi.fn(),
    existingQuickPicks: [],
    quickPickSaving: false,
    onQuickPickSelect: vi.fn(),
    openQuickPickDialog: vi.fn(),
    onSaveAsQuickPick: vi.fn(),
  }),
}));

vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useCancelImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecordOutsideImmunization: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateUpdateImmunizationOrder: () => ({ mutateAsync: mockCreateUpdateOrder, isPending: false }),
  useGetImmunizationOrders: () => ({ data: undefined, isLoading: false }),
  useGetImmunizationForecast: () => ({ data: undefined, isLoading: false, isError: false }),
  useGetVaccines: () => ({ data: [], isLoading: false }),
}));

vi.mock('../../src/features/immunization/components/OrderHistoryTable', () => ({
  OrderHistoryTable: () => <div />,
}));

// The line shows its vaccine and errors, and offers its remove button
vi.mock('../../src/features/immunization/hooks/useVaccineInventory', () => ({
  useVfcEligibility: () => ({ data: undefined, isLoading: false }),
  useConfirmVfcEligibility: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVaccineLotsOnHand: () => ({ data: [] }),
  useVaccineInventoryAtLocation: () => ({ data: undefined }),
}));

vi.mock('../../src/features/immunization/components/ImmunizationSentences', () => ({
  ImmunizationSectionLabel: ({ children }: any) => <h3>{children}</h3>,
  ImmunizationSentences: ({ line, onChange }: any) => (
    <div data-testid="immunization-line" data-vaccine={line.details.medication?.name ?? ''}>
      <span data-testid="line-cpt">
        {(line.administrationDetails.cptCodes ?? [])
          .map((cpt: any) => (cpt.billableUnits ? `${cpt.code}×${cpt.billableUnits}` : cpt.code))
          .join(' ')}
      </span>
      <span data-testid="line-origin">{line.cptOrigin ?? ''}</span>
      <button
        onClick={() =>
          onChange({
            ...line,
            cptOrigin: 'manual',
            administrationDetails: { ...line.administrationDetails, cptCodes: [{ code: '90471', display: 'x' }] },
          })
        }
      >
        Type codes on {line.details.medication?.name}
      </button>
    </div>
  ),
}));

// ─── Component + real draft store (imports after all vi.mock calls) ──────────

import { ImmunizationFormValues } from '../../src/features/immunization/components/immunizationLines';
import { ImmunizationOrderCreateEdit } from '../../src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { useImmunizationOrderStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-imm-codes';
const PROVIDER = { id: 'prov-1', name: 'Dr. Test' };
const TWO_MONTHS_OLD = DateTime.now().minus({ months: 2 }).toISODate();
const ADULT = DateTime.now().minus({ years: 40 }).toISODate();

const vaccineLine = (
  vaccine: string,
  cvx: string,
  extra: Partial<ImmunizationFormValues> = {}
): ImmunizationFormValues => ({
  details: { medication: { id: `${vaccine}-id`, name: vaccine }, dose: '0.5', units: 'mL', orderedProvider: PROVIDER },
  administrationDetails: { cvx },
  ...extra,
});
const quickPicked = (vaccine: string, cvx: string): ImmunizationFormValues =>
  vaccineLine(vaccine, cvx, {
    cptOrigin: 'quickpick',
    administrationDetails: { cvx, cptCodes: [{ code: '90471', display: 'admin' }] },
  });

const seedLines = (...lines: ImmunizationFormValues[]): void => {
  useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { lines });
};
const codes = (): string[] => screen.getAllByTestId('line-cpt').map((cpt) => cpt.textContent ?? '');
const box = (): HTMLElement => screen.getByTestId(dataTestIds.orderVaccinePage.questionsBox);

describe('ImmunizationOrderCreateEdit — suggested CPT codes and the counseling question', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useImmunizationOrderStore.setState({ draftsByEncounterId: {} });
    patientBirthDate.value = TWO_MONTHS_OLD;
  });

  it('assumes counseled for a child: 90460 / 90461 on the suggested lines, and asks', async () => {
    seedLines(vaccineLine('Pediarix', '110'), vaccineLine('ActHIB', '48'), vaccineLine('Prevnar 20', '216'));
    render(<ImmunizationOrderCreateEdit />);

    await waitFor(() => expect(codes()).toEqual(['90460 90461×4', '90460', '90460']));
    expect(within(box()).getByText('Questions')).toBeInTheDocument();
    expect(within(box()).getByText(/Counseled on today.s vaccines\?/)).toBeInTheDocument();
    expect(within(box()).getByText('Codes assume yes until answered.')).toBeInTheDocument();
    expect(within(box()).getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('No moves the suggested lines to 90471 / 90472; Yes back to 90460 / 90461', async () => {
    seedLines(vaccineLine('Pediarix', '110'), vaccineLine('ActHIB', '48'), vaccineLine('Prevnar 20', '216'));
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);
    await waitFor(() => expect(codes()[0]).toBe('90460 90461×4'));

    await user.click(within(box()).getByRole('button', { name: 'No' }));
    await waitFor(() => expect(codes()).toEqual(['90471', '90472', '90472']));
    expect(within(box()).getByText('90471 / 90472 on the suggested lines.')).toBeInTheDocument();
    expect(within(box()).getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(box()).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(codes()).toEqual(['90460 90461×4', '90460', '90460']));
    expect(within(box()).getByText('90460 / 90461 on the suggested lines.')).toBeInTheDocument();
  });

  it('answers per vaccine, seeded from the visit answer, and collapses back to one answer', async () => {
    seedLines(vaccineLine('Pediarix', '110'), vaccineLine('ActHIB', '48'));
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);
    await waitFor(() => expect(codes()).toEqual(['90460 90461×4', '90460']));

    await user.click(within(box()).getByRole('button', { name: 'No' }));
    await user.click(within(box()).getByRole('button', { name: 'Answers differ by vaccine' }));
    const questions = within(box()).getAllByTestId(dataTestIds.orderVaccinePage.counselingQuestion);
    expect(questions.map((question) => question.textContent)).toEqual([
      'Pediarix counseled?YesNo',
      'ActHIB counseled?YesNo',
    ]);
    expect(within(questions[0]).getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(questions[0]).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(codes()).toEqual(['90460 90461×4', '90471']));

    await user.click(within(box()).getByRole('button', { name: 'Same answer for all' }));
    await waitFor(() => expect(codes()).toEqual(['90471', '90472']));
    expect(within(box()).getByText(/Counseled on today.s vaccines\?/)).toBeInTheDocument();
  });

  it("keeps a person's codes and takes their 90471 as the visit's first; the box goes once no line is suggested", async () => {
    patientBirthDate.value = ADULT;
    seedLines(vaccineLine('Boostrix', '115'), vaccineLine('Fluzone', '140'));
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);
    await waitFor(() => expect(codes()).toEqual(['90471', '90472']));

    await user.click(screen.getByRole('button', { name: 'Type codes on Fluzone' }));
    await waitFor(() => expect(codes()).toEqual(['90472', '90471']));
    expect(screen.getAllByTestId('line-origin').map((origin) => origin.textContent)).toEqual(['suggested', 'manual']);
  });

  it('shows no question for an adult: 9047x only', async () => {
    patientBirthDate.value = ADULT;
    seedLines(vaccineLine('Boostrix', '115'), vaccineLine('Fluzone', '140'));
    render(<ImmunizationOrderCreateEdit />);

    await waitFor(() => expect(codes()).toEqual(['90471', '90472']));
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.questionsBox)).not.toBeInTheDocument();
  });

  it('shows no question when every line came from a quick pick, and leaves their codes', async () => {
    seedLines(quickPicked('Pediarix', '110'), quickPicked('ActHIB', '48'));
    render(<ImmunizationOrderCreateEdit />);

    await waitFor(() => expect(codes()).toEqual(['90471', '90471']));
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.questionsBox)).not.toBeInTheDocument();
  });

  it('the box goes once a person types codes on the last suggested line', async () => {
    seedLines(vaccineLine('Pediarix', '110'));
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);
    await waitFor(() => expect(box()).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Type codes on Pediarix' }));
    await waitFor(() =>
      expect(screen.queryByTestId(dataTestIds.orderVaccinePage.questionsBox)).not.toBeInTheDocument()
    );
    expect(codes()).toEqual(['90471']);
  });
});
