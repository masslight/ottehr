// The order screen's external line: "[vaccine] administered externally × on [date given] at [where], from [source]".
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/in-person/hooks/useImmunization', () => ({
  useGetVaccines: () => ({
    data: [{ id: 'vac-dtap', name: 'DTaP vaccine' }],
    isLoading: false,
  }),
}));
vi.mock('src/features/immunization/hooks/useImmunizationDiagnosisOptions', () => ({
  useImmunizationDiagnosisOptions: () => [],
}));
vi.mock('src/components/input/EmployeeSelectInput', () => ({
  useEmployeeOptions: () => ({ options: [], isLoading: false }),
}));
vi.mock('src/features/immunization/hooks/useVaccineInventory', () => ({
  useVfcEligibility: () => ({ data: undefined, isLoading: false }),
  useConfirmVfcEligibility: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVaccineLotsOnHand: () => ({ data: [] }),
}));
vi.mock('src/components/input/CptCodesInput', () => ({
  CptCodesInput: () => <div data-testid="cpt-codes-input" />,
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import {
  emptyImmunizationLine,
  ImmunizationLine,
  isUntouchedOrderLine,
  orderButtonLabel,
  outsideLineErrors,
  outsideLineToRequest,
  toggleOutside,
} from '../../src/features/immunization/components/immunizationLines';
import { ImmunizationSentences } from '../../src/features/immunization/components/ImmunizationSentences';

const renderLine = (line: ImmunizationLine): ReturnType<typeof vi.fn> => {
  const onChange = vi.fn();
  render(
    <ImmunizationSentences
      line={line}
      index={0}
      onChange={onChange}
      quickPicks={[]}
      onQuickPick={vi.fn()}
      errors={[]}
      readOnly={false}
    />
  );
  return onChange;
};

describe('externally administered immunization line', () => {
  it('reads as a sentence with the vaccine, date given, where and source, and offers the lot as a link', async () => {
    const line = toggleOutside(emptyImmunizationLine());
    const onChange = renderLine(line);
    const user = userEvent.setup();

    const outsideLine = screen.getByTestId(dataTestIds.orderVaccinePage.outsideLine);
    expect(outsideLine).toHaveTextContent(/administered externally/);
    expect(outsideLine).toHaveTextContent(/on .* at .*, from/);
    expect(within(outsideLine).getByTestId(dataTestIds.orderVaccinePage.outsideDate)).toBeInTheDocument();
    expect(within(outsideLine).getByTestId(dataTestIds.orderVaccinePage.outsidePlace)).toBeInTheDocument();
    expect(within(outsideLine).getByTestId(dataTestIds.orderVaccinePage.outsideSource)).toBeInTheDocument();
    // no order or administration blanks
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.dose)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administration' })).not.toBeInTheDocument();
    // the vaccine is the only blank the line needs
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine)).toHaveAttribute('data-needed');
    expect(within(outsideLine).getByTestId(dataTestIds.orderVaccinePage.outsideDate)).not.toHaveAttribute(
      'data-needed'
    );

    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.outsideLot)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /\+ lot and manufacturer/ }));
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.outsideLot)).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.manufacturer)).toBeInTheDocument();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.vaccine));
    await user.click(screen.getByRole('option', { name: 'DTaP vaccine' }));
    expect(onChange).toHaveBeenCalledWith({
      ...line,
      details: { ...line.details, medication: { id: 'vac-dtap', name: 'DTaP vaccine' } },
    });
  });

  it('the × after "administered externally" turns the line back into an order line', async () => {
    const line = toggleOutside(emptyImmunizationLine());
    const onChange = renderLine(line);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Remove administered externally' }));

    expect(onChange).toHaveBeenCalledWith({ ...line, outside: undefined });
  });

  it('picks the source from the CDC list, worded for children and adults', async () => {
    const line = toggleOutside(emptyImmunizationLine());
    const onChange = renderLine(line);
    const user = userEvent.setup();

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.outsideSource));
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual([
      'a written record',
      "another provider's records",
      "the patient's or family's recall",
      'another registry',
      'a school record',
      'a birth certificate',
      'a public agency',
    ]);
    await user.click(screen.getByRole('option', { name: 'a school record' }));

    expect(onChange).toHaveBeenCalledWith({ ...line, outside: { source: 'school-record' } });
  });
});

describe('external line model', () => {
  it('an untouched order line converts; a written-in one does not', () => {
    expect(isUntouchedOrderLine(emptyImmunizationLine({ id: 'p', name: 'Dr' }))).toBe(true);
    expect(isUntouchedOrderLine({ ...emptyImmunizationLine(), details: { dose: '0.5' } })).toBe(false);
    expect(isUntouchedOrderLine(toggleOutside(emptyImmunizationLine()))).toBe(false);
  });

  it('needs only the vaccine, and no future date', () => {
    const line = toggleOutside(emptyImmunizationLine());
    expect(outsideLineErrors(line)).toEqual(['Pick the immunization']);
    expect(
      outsideLineErrors({
        ...line,
        details: { medication: { id: 'v', name: 'DTaP' } },
        outside: { dateGiven: '2099-01-01' },
      })
    ).toEqual(['The date given cannot be in the future']);
    expect(outsideLineErrors({ ...line, details: { medication: { id: 'v', name: 'DTaP' } } })).toEqual([]);
  });

  it('the save button counts orders and outside doses', () => {
    const order = emptyImmunizationLine();
    const outside = toggleOutside(emptyImmunizationLine());
    expect(orderButtonLabel([order])).toBe('Order Immunization');
    expect(orderButtonLabel([order, order, outside, outside])).toBe('Order 2 Immunizations · Record 2 Outside');
    expect(orderButtonLabel([outside])).toBe('Record 1 Outside');
  });

  it('sends only the dose: vaccine, codes, lot and manufacturer, when, where and from what source', () => {
    const line: ImmunizationLine = {
      ...toggleOutside(emptyImmunizationLine()),
      details: {
        medication: { id: 'v', name: 'DTaP' },
        manufacturer: 'Sanofi',
        orderedProvider: { id: 'p', name: 'Dr' },
      },
      administrationDetails: { lot: 'L1', cvx: '20', mvx: '', ndc: '', expDate: '', cptCodes: [], visGiven: false },
      outside: { dateGiven: '2026-03-02', place: 'Mercy Pediatrics', source: 'written-record' },
    };
    expect(outsideLineToRequest(line, 'enc-1')).toEqual({
      encounterId: 'enc-1',
      vaccine: { id: 'v', name: 'DTaP' },
      cvx: '20',
      manufacturer: 'Sanofi',
      lot: 'L1',
      dateGiven: '2026-03-02',
      place: 'Mercy Pediatrics',
      source: 'written-record',
    });
  });
});
