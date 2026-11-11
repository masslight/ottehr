import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime, Settings } from 'luxon';
import { useState } from 'react';
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

const ndcLookup = vi.hoisted(() => ({
  results: {} as Record<string, unknown>,
  calls: [] as string[],
}));
vi.mock('src/features/admin/inventory/useNdcLookup', () => ({
  useNdcLookup: (ndc: string) => {
    ndcLookup.calls.push(ndc);
    return ndcLookup.results[ndc] ?? { status: 'idle' };
  },
}));

vi.mock('src/features/immunization/hooks/useImmunizationDiagnosisOptions', () => ({
  useImmunizationDiagnosisOptions: () => [{ resourceId: 'cond-1', display: 'Z23 - Encounter for immunization' }],
}));

vi.mock('src/components/input/EmployeeSelectInput', () => ({
  useEmployeeOptions: () => ({ options: [{ id: 'prov-1', name: 'Dr. Test' }], isLoading: false }),
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

  it('shows the duplicate warning under the vaccine as plain text, and none when read-only', () => {
    const line = { ...emptyImmunizationLine(), details: { medication: { id: 'engerix', name: 'Engerix-B' } } };
    const props = {
      line,
      index: 1,
      onChange: vi.fn(),
      quickPicks: [],
      onQuickPick: vi.fn(),
      errors: [],
      duplicateWarning: 'Hep B is also in <b>Pediarix</b> above.',
    };
    const { unmount } = render(<ImmunizationSentences {...props} readOnly={false} />);
    const warning = screen.getByTestId(dataTestIds.orderVaccinePage.duplicateWarning);
    expect(warning).toHaveTextContent('Hep B is also in <b>Pediarix</b> above.');
    expect(warning.querySelector('b')).toBeNull();
    // under the vaccine sentence, before the dose sentence
    expect(warning.previousElementSibling).toHaveTextContent(/Engerix-B/);
    unmount();
    render(<ImmunizationSentences {...props} readOnly />);
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.duplicateWarning)).not.toBeInTheDocument();
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
    expect(isNeeded(dataTestIds.vaccineDetailsPage.lotNumber)).toBe(false);
    // the manufacturer is no longer typed: it comes from the lot picked from stock (or the MVX pick)
    expect(screen.queryByTestId(dataTestIds.orderVaccinePage.manufacturer)).not.toBeInTheDocument();
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
    // no CVX blank (it is saved from the vaccine); the manufacturer shows its name only, and saves the MVX code
    expect(screen.queryByText(/CVX/)).not.toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.mvxCode)).toHaveTextContent(/^Merck and Co., Inc.$/);
    expect(screen.getByText(/^\s*Manufacturer\s*$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Administration' })).toBeInTheDocument();
  });

  it('offers the vaccine site list, and a site saved from the medication list still reads', async () => {
    renderLine({
      ...emptyImmunizationLine(),
      details: { location: { code: '206007', name: 'Left Gluteus Maximus' } },
    });
    const location = screen.getByTestId(dataTestIds.orderVaccinePage.location);
    expect(location).toHaveTextContent(/left gluteus maximus/i);

    await userEvent.setup().click(location);
    for (const site of [
      'Left deltoid',
      'Left thigh (vastus lateralis)',
      'Right gluteus',
      'Nose (intranasal)',
      'Other',
    ]) {
      expect(screen.getByRole('option', { name: site })).toBeInTheDocument();
    }
    expect(screen.queryByRole('option', { name: 'given via nebulizer' })).not.toBeInTheDocument();
  });

  it('a typed given date keeps the date and opens at the current time', async () => {
    // Browsers give the years typed on the way to 2026 (0002, 0020, 0202) offsets with seconds (-04:56:02);
    // an IANA default zone does the same here, where Node's system zone rounds them to whole minutes.
    const defaultZone = Settings.defaultZone;
    Settings.defaultZone = 'America/New_York';
    try {
      let saved: string | undefined;
      const Harness = (): JSX.Element => {
        const [line, setLine] = useState(emptyImmunizationLine());
        saved = line.administrationDetails.administeredDateTime;
        return (
          <ImmunizationSentences
            line={line}
            index={0}
            onChange={setLine}
            quickPicks={[]}
            onQuickPick={vi.fn()}
            errors={[]}
            readOnly={false}
          />
        );
      };
      render(<Harness />);
      const user = userEvent.setup();
      await user.click(screen.getByTestId(dataTestIds.vaccineDetailsPage.administeredDate));
      await user.keyboard('11112026');

      const given = DateTime.fromISO(saved ?? '');
      expect(given.toISODate()).toBe('2026-11-11');
      expect(
        Math.abs(
          given
            .set({ year: 2026, month: 11, day: 11 })
            .diff(DateTime.now().set({ year: 2026, month: 11, day: 11 }), 'minutes').minutes
        )
      ).toBeLessThan(2);
    } finally {
      Settings.defaultZone = defaultZone;
    }
  });

  describe('a typed NDC', () => {
    const hepb = { id: 'vac-hepb', name: 'Hep B vaccine' };
    const product = { packageNdc: '58160-0820-11', name: 'Engerix-B', manufacturer: 'GSK', rxcuis: [] };
    let saved: ImmunizationLine | undefined;
    const Harness = ({ start }: { start: ImmunizationLine }): JSX.Element => {
      const [line, setLine] = useState(start);
      saved = line;
      return (
        <ImmunizationSentences
          line={line}
          index={0}
          onChange={setLine}
          quickPicks={[]}
          onQuickPick={vi.fn()}
          errors={[]}
          readOnly={false}
        />
      );
    };
    const withVaccine = (administrationDetails = {}): ImmunizationLine => ({
      ...emptyImmunizationLine(),
      details: { medication: hepb },
      administrationDetails,
    });
    beforeEach(() => {
      ndcLookup.results = {};
      ndcLookup.calls = [];
    });

    it('fills an empty manufacturer from the box', async () => {
      ndcLookup.results['58160-0820-11'] = {
        status: 'match',
        comparedBy: 'cvx',
        product,
        vaccine: { cvx: '08', vaccineName: 'Hep B', mvx: 'SKB' },
      };
      render(<Harness start={withVaccine()} />);
      await userEvent.setup().type(screen.getByTestId(dataTestIds.vaccineDetailsPage.ndcCode), '58160-0820-11');
      expect(saved?.administrationDetails.mvx).toBe('SKB');
      expect(screen.queryByTestId(dataTestIds.vaccineDetailsPage.ndcMismatch)).not.toBeInTheDocument();
    });

    it('never overwrites a manufacturer picked by hand, and warns when the box is another vaccine', async () => {
      ndcLookup.results['00006-4681-00'] = {
        status: 'mismatch',
        comparedBy: 'cvx',
        product: { ...product, packageNdc: '00006-4681-00', name: 'M-M-R II' },
        vaccine: { cvx: '03', vaccineName: 'MMR', mvx: 'MSD' },
      };
      render(<Harness start={withVaccine({ mvx: 'PMC' })} />);
      await userEvent.setup().type(screen.getByTestId(dataTestIds.vaccineDetailsPage.ndcCode), '00006-4681-00');
      expect(saved?.administrationDetails.mvx).toBe('PMC');
      expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.ndcMismatch)).toHaveTextContent(
        'NDC 00006-4681-00 is MMR, not Hep B vaccine. Check the box.'
      );
    });

    it('does not look up an NDC a stock lot filled', () => {
      render(<Harness start={withVaccine({ ndc: '58160-0820-11', lot: 'L1' })} />);
      expect(ndcLookup.calls.every((ndc) => ndc === '')).toBe(true);
    });
  });
});
