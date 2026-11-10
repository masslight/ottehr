import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (must come before component imports) ─────────────────────────────

vi.mock('src/features/visits/in-person/hooks/useImmunization', () => ({
  useGetVaccines: () => ({
    data: [
      { id: 'vac-mmr', name: 'MMR vaccine' },
      { id: 'vac-dtap', name: 'DTaP vaccine' },
    ],
    isLoading: false,
  }),
}));

vi.mock('src/features/immunization/hooks/useImmunizationDiagnosisOptions', () => ({
  useImmunizationDiagnosisOptions: () => [{ resourceId: 'cond-1', display: 'Z23 - Encounter for immunization' }],
}));

vi.mock('src/components/input/EmployeeSelectInput', () => ({
  useEmployeeOptions: () => ({ options: [{ id: 'prov-1', name: 'Dr. Test' }], isLoading: false }),
}));

vi.mock('src/components/input/CptCodesInput', () => ({
  CptCodesInput: () => <div data-testid="cpt-codes-input" />,
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { emptyImmunizationLine, ImmunizationLine } from '../../src/features/immunization/components/immunizationLines';
import { ImmunizationSentences } from '../../src/features/immunization/components/ImmunizationSentences';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUICK_PICK = {
  id: 'qp-1',
  name: 'MMR 0.5 mL SC',
  vaccine: { id: 'vac-mmr', name: 'MMR vaccine' },
  dose: '0.5',
  units: 'ml',
};

const renderLine = (
  line: ImmunizationLine
): { onChange: ReturnType<typeof vi.fn>; onQuickPick: ReturnType<typeof vi.fn> } => {
  const onChange = vi.fn();
  const onQuickPick = vi.fn();
  render(
    <ImmunizationSentences
      line={line}
      index={0}
      onChange={onChange}
      quickPicks={[QUICK_PICK]}
      onQuickPick={onQuickPick}
      errors={[]}
      readOnly={false}
    />
  );
  return { onChange, onQuickPick };
};

const isNeeded = (testId: string): boolean => screen.getByTestId(testId).hasAttribute('data-needed');

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ImmunizationSentences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the blanks the order requires, and only those', () => {
    renderLine(emptyImmunizationLine());

    expect(isNeeded(dataTestIds.orderVaccinePage.vaccine)).toBe(true);
    expect(isNeeded(dataTestIds.orderVaccinePage.dose)).toBe(true);
    expect(isNeeded(dataTestIds.orderVaccinePage.units)).toBe(true);
    expect(isNeeded(dataTestIds.orderVaccinePage.orderedBy)).toBe(true);
    expect(isNeeded(dataTestIds.orderVaccinePage.associatedDx)).toBe(false);
    expect(isNeeded(dataTestIds.orderVaccinePage.route)).toBe(false);
    expect(isNeeded(dataTestIds.orderVaccinePage.location)).toBe(false);
    expect(isNeeded(dataTestIds.orderVaccinePage.manufacturer)).toBe(false);
    expect(isNeeded(dataTestIds.vaccineDetailsPage.lotNumber)).toBe(false);
  });

  it('picking a vaccine from the menu fills only the vaccine', async () => {
    const line = {
      ...emptyImmunizationLine(),
      details: { dose: '1', orderedProvider: { id: 'prov-1', name: 'Dr. Test' } },
    };
    const { onChange, onQuickPick } = renderLine(line);
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
    await user.type(screen.getByRole('combobox', { name: 'Immunization' }), 'dtap');
    const vaccines = screen.getByRole('listbox', { name: 'Vaccines' });
    expect(within(vaccines).getAllByRole('option')).toHaveLength(1);
    await user.click(within(vaccines).getByRole('option', { name: 'DTaP vaccine' }));

    expect(onQuickPick).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({
      ...line,
      details: { ...line.details, medication: { id: 'vac-dtap', name: 'DTaP vaccine' } },
    });
  });

  it('lists quick picks by their name or vaccine, and picking one hands it to the page', async () => {
    const { onChange, onQuickPick } = renderLine(emptyImmunizationLine());
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
    await user.type(screen.getByRole('combobox', { name: 'Immunization' }), 'mmr vaccine');
    const quickPicks = screen.getByRole('listbox', { name: 'Quick picks' });
    await user.click(within(quickPicks).getByRole('option', { name: 'MMR 0.5 mL SC' }));

    expect(onQuickPick).toHaveBeenCalledWith(QUICK_PICK);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers instructions as a link until opened', async () => {
    renderLine(emptyImmunizationLine());
    const user = userEvent.setup();

    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.instructions)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /\+ instructions/ }));

    expect(screen.getByTestId(dataTestIds.orderVaccinePage.instructions)).toBeInTheDocument();
  });

  it('shows the administration details as sentences with the saved values', () => {
    renderLine({
      ...emptyImmunizationLine(),
      administrationDetails: { lot: 'L-42', ndc: '00006-4681-00', expDate: '2027-01-31', cvx: '03', mvx: 'MSD' },
    });

    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.lotNumber)).toHaveValue('L-42');
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.ndcCode)).toHaveValue('00006-4681-00');
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.cvxCode)).toHaveValue('03');
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.mvxCode)).toHaveValue('MSD');
    expect(screen.getByRole('heading', { name: 'Administration' })).toBeInTheDocument();
  });
});
