import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PrescriptionQuickPickData, PrescriptionSetQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
  withProduct,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { PrescriptionSentences } from '../../src/features/visits/in-person/components/erx/PrescriptionSentences';
import {
  missingSetMembersText,
  withListedQuickPick,
  withPrescriptionSet,
} from '../../src/features/visits/in-person/components/erx/prescriptionSuggestions';
import { VisitWeight } from '../../src/features/visits/in-person/components/erx/useVisitWeight';
import { detailed, ERX_PRODUCT_DETAILS } from './helpers/erxProducts';

// The real suggestions seam: the rows here come from the quick picks and sets given. The medication search answers
// with the liquids below whatever is typed; a test sets `fetching` to see it still searching.
const medicationSearch = vi.hoisted(() => ({ fetching: false }));
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () =>
    medicationSearch.fetching
      ? { data: undefined, isFetching: true, isError: false }
      : { data: [LIQUIDS], isFetching: false, isError: false },
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { resourceType: 'Encounter', id: 'encounter-1', status: 'in-progress' } }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: undefined }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => undefined }));
vi.mock('../../src/features/admin/patient-education/useIcd10SearchInput', () => ({
  useIcd10SearchInput: () => ({ inputValue: '', setInputValue: () => undefined, options: [], isFetching: false }),
}));

const LIQUIDS = {
  name: 'Amoxicillin',
  strengths: [
    detailed({ strength: '400 mg/5ml Susp', ndcs: ['00093416173'] }),
    detailed({ strength: '250 mg/5ml Susp', ndcs: ['00093415573'] }),
  ],
};
const AMOX = detailed({ ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp' });
const WEIGHT: VisitWeight = { kg: 28.12, takenAt: '2026-10-08T14:00:00Z', thisVisit: true };

const BY_WEIGHT: PrescriptionQuickPickData = {
  id: 'qp-strep',
  name: 'Amox strep',
  ndc: AMOX.ndc,
  medicationDescription: AMOX.description,
  ...ERX_PRODUCT_DETAILS[AMOX.ndc],
  quantityValue: 120,
  quantityUnit: 'Milliliter',
  daysSupply: 10,
  numberOfRefills: 0,
  substitutionAllowed: false,
  noteToPharmacy: 'Shake well',
  dosing: { rate: 25, basis: 'mg/kg/dose', frequency: 'twice daily', durationDays: 10 },
};
const SAVED_TEXT: PrescriptionQuickPickData = {
  id: 'qp-text',
  name: 'Amox as written',
  ndc: AMOX.ndc,
  medicationDescription: AMOX.description,
  ...ERX_PRODUCT_DETAILS[AMOX.ndc],
  quantityValue: 100,
  quantityUnit: 'Milliliter',
  daysSupply: 10,
  patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
};
const IBUPROFEN: PrescriptionQuickPickData = {
  id: 'qp-ibu',
  name: 'Ibuprofen pain',
  ndc: '00904585354',
  medicationDescription: 'Ibuprofen 100 mg/5ml Susp',
  ...ERX_PRODUCT_DETAILS['00904585354'],
  quantityValue: 120,
  quantityUnit: 'Milliliter',
  patientInstructions: 'Take 5 mL by mouth every 6 hours as needed for pain',
};
// The form's list is sorted by name.
const QUICK_PICKS = [SAVED_TEXT, BY_WEIGHT, IBUPROFEN];

const set = (
  id: string,
  name: string,
  memberIds: string[],
  status: PrescriptionSetQuickPickData['status'] = 'Active'
): PrescriptionSetQuickPickData => ({ id, name, status, memberIds });
const ACUTE_OTITIS = set('set-ao', 'Acute otitis', ['qp-ibu', 'qp-strep', 'qp-gone']);
const EAR_INFECTION = set('set-ear', 'Ear infection', ['qp-strep', 'qp-ibu']);
const RETIRED = set('set-old', 'Bronchitis', ['qp-strep'], 'Inactive');
const SETS = [ACUTE_OTITIS, RETIRED, EAR_INFECTION];

const notices: string[] = [];
let latest: PrescriptionLine[] = [];

/** The order form's lines, with its handling of quick picks and sets. */
const Form = ({
  initial,
  quickPicks = QUICK_PICKS,
  sets = SETS,
  weight = WEIGHT,
}: {
  initial: PrescriptionLine[];
  quickPicks?: PrescriptionQuickPickData[];
  sets?: PrescriptionSetQuickPickData[];
  weight?: VisitWeight;
}): JSX.Element => {
  const [lines, setLines] = useState(initial);
  latest = lines;
  const weightKg = weight.kg;
  return (
    <>
      {lines.map((line, index) => (
        <PrescriptionSentences
          key={line.key}
          line={line}
          index={index}
          onChange={(next) => setLines((current) => current.map((item) => (item.key === line.key ? next : item)))}
          quickPicks={quickPicks}
          onQuickPick={(quickPick) =>
            setLines((current) =>
              current.map((item) => (item.key === line.key ? withListedQuickPick(line, quickPick, weightKg) : item))
            )
          }
          sets={sets}
          onSet={(picked, used) => {
            const { lines: next, missing } = withPrescriptionSet(line, picked, quickPicks, weightKg, used);
            setLines((current) => current.flatMap((item) => (item.key === line.key ? next : [item])));
            if (missing) notices.push(missingSetMembersText(missing));
          }}
          visitDiagnoses={[]}
          weightKg={weightKg}
          weight={weight}
          errors={[]}
          readOnly={false}
        />
      ))}
    </>
  );
};

/** A line as picking the quick pick from the list on a new line makes it. */
const listed = (quickPick: PrescriptionQuickPickData): Omit<PrescriptionLine, 'key'> => {
  const { key: _key, ...line } = withListedQuickPick(emptyPrescriptionLine(), quickPick, WEIGHT.kg);
  return line;
};
const withoutKey = ({ key: _key, ...line }: PrescriptionLine): Omit<PrescriptionLine, 'key'> => line;

const amoxLine = (): PrescriptionLine => withProduct(emptyPrescriptionLine(), LIQUIDS, LIQUIDS.strengths[0]);

const suggestionRow = (index: number): HTMLElement =>
  screen.getAllByRole('button', { name: /^(Use this prescription|Write my own)$/ })[index].closest('.MuiBox-root')!
    .parentElement!;

const openMenu = async (user: ReturnType<typeof userEvent.setup>, index = 0): Promise<HTMLElement> => {
  await user.click(screen.getAllByRole('button', { name: /^medication/ })[index]);
  return screen.getByRole('listbox', { name: 'Medication' });
};

/** The menu's rows as read: a set's "Set: name" and count, a quick pick's name and product, a medication's name. */
const menuItems = (list: HTMLElement): string[] =>
  Array.from(list.querySelectorAll('[role="option"]')).map((item) => item.textContent ?? '');

/** Whether the row is set in under the medication above it. */
const nested = (name: string): boolean => {
  const padding = getComputedStyle(screen.getByText(name).parentElement as HTMLElement).paddingLeft;
  return padding !== '' && padding !== '0px';
};

const SETS_ROWS = ['Set: Acute otitis2 prescriptions', 'Set: Ear infection2 prescriptions'];
const AMOX_ROWS = ['Amox as writtenAmoxicillin 400 mg/5ml Susp', 'Amox strepAmoxicillin 400 mg/5ml Susp'];
const IBUPROFEN_ROW = 'Ibuprofen painIbuprofen 100 mg/5ml Susp';

describe('Prescription sets on the order form', () => {
  beforeEach(() => {
    notices.length = 0;
  });

  describe('the medication menu', () => {
    it('lists the Active sets, then the quick picks, in one list without headings', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      const list = await openMenu(user);
      expect(menuItems(list)).toEqual([...SETS_ROWS, ...AMOX_ROWS, IBUPROFEN_ROW]);
      expect(list.querySelector('.MuiAutocomplete-groupLabel')).toBeNull();
      // Quick picks' and sets' names bold; "Set:" muted, not bold.
      expect(screen.getByText('Amox strep')).toHaveStyle({ fontWeight: 700 });
      expect(screen.getByText('Acute otitis')).toHaveStyle({ fontWeight: 700 });
      expect(screen.getAllByText('Set:')[0]).not.toHaveStyle({ fontWeight: 700 });
      // Inactive: waiting for review in Admin.
      expect(screen.queryByText('Bronchitis')).not.toBeInTheDocument();
      expect(screen.queryByText('Type to search more quick picks and medications')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Select a quick pick or type to search')).toBeInTheDocument();
    });

    it('lists up to 10 sets and 10 quick picks before anything is typed, then says to type for more', async () => {
      const user = userEvent.setup();
      const many = Array.from({ length: 12 }, (_, i) => ({ ...IBUPROFEN, id: `qp-${i}`, name: `Pick ${10 + i}` }));
      const sets = Array.from({ length: 11 }, (_, i) => set(`set-${i}`, `Set ${10 + i}`, ['qp-0']));
      render(<Form initial={[emptyPrescriptionLine()]} quickPicks={many} sets={sets} />);
      const items = menuItems(await openMenu(user));
      expect(items).toHaveLength(10 + 10 + 1);
      expect(items[9]).toBe('Set: Set 191 prescription');
      expect(items[10]).toBe('Pick 10Ibuprofen 100 mg/5ml Susp');
      expect(items[20]).toBe('Type to search more quick picks and medications');
      expect(screen.getByRole('option', { name: 'Type to search more quick picks and medications' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.queryByText('Set 20')).not.toBeInTheDocument();
      expect(screen.queryByText('Pick 20')).not.toBeInTheDocument();
      // Typed, every match shows: past the first 10.
      await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'pick 2');
      expect(screen.getByText('Pick 20')).toBeInTheDocument();
      expect(screen.getByText('Pick 21')).toBeInTheDocument();
    });

    it('typed: the matching sets, then each medication with its quick picks by NDC under it, then other matching quick picks', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      const list = (): HTMLElement => screen.getByRole('listbox', { name: 'Medication' });
      // Both sets hold the ibuprofen (matched by product, in any case). The amoxicillin quick picks don't match the
      // text but order the search's medication, so they sit under it; the ibuprofen one matches and orders none.
      await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'IBU');
      expect(menuItems(list())).toEqual([...SETS_ROWS, 'Amoxicillin', ...AMOX_ROWS, IBUPROFEN_ROW]);
      expect(nested('Amox strep')).toBe(true);
      expect(nested('Ibuprofen pain')).toBe(false);
      expect(screen.getByText('Amoxicillin')).not.toHaveStyle({ fontWeight: 700 });
      // A quick pick matching the text and under a medication is listed once, there.
      await user.clear(screen.getByRole('combobox', { name: 'Medication' }));
      await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'strep');
      expect(menuItems(list())).toEqual([...SETS_ROWS, 'Amoxicillin', ...AMOX_ROWS]);
      // One letter is too few for the medication search.
      await user.clear(screen.getByRole('combobox', { name: 'Medication' }));
      await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'w');
      expect(menuItems(list())).toEqual(['Amox as writtenAmoxicillin 400 mg/5ml Susp']);
    });

    it('holds the medications’ place with "Searching medications…" while the search runs', async () => {
      medicationSearch.fetching = true;
      try {
        const user = userEvent.setup();
        render(<Form initial={[emptyPrescriptionLine()]} />);
        await openMenu(user);
        await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'ibu');
        expect(menuItems(screen.getByRole('listbox', { name: 'Medication' }))).toEqual([
          ...SETS_ROWS,
          'Searching medications…',
          IBUPROFEN_ROW,
        ]);
        expect(screen.getByRole('option', { name: 'Searching medications…' })).toHaveAttribute('aria-disabled', 'true');
      } finally {
        medicationSearch.fetching = false;
      }
    });

    it('picks a medication from the search as before: its strength next', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'amox');
      await user.click(screen.getByRole('option', { name: 'Amoxicillin' }));
      expect(latest[0]).toMatchObject({ drug: LIQUIDS, medication: null });
      expect(screen.getByRole('button', { name: 'strength (empty)' })).toBeInTheDocument();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('picks a quick pick as before: the line as the quick pick fills it', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await user.click(within(await openMenu(user)).getByText('Amox as written'));
      expect(withoutKey(latest[0])).toEqual(listed(SAVED_TEXT));
      expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
        'Take 5 mL by mouth twice daily for 10 days.'
      );
    });

    it('fills an empty line with the first quick pick and adds the rest after it, each as if picked itself', async () => {
      const user = userEvent.setup();
      const after = withListedQuickPick(emptyPrescriptionLine(), SAVED_TEXT, WEIGHT.kg);
      render(<Form initial={[emptyPrescriptionLine(), after]} />);
      await user.click(within(await openMenu(user)).getByText('Ear infection'));
      expect(latest.map(withoutKey)).toEqual([listed(BY_WEIGHT), listed(IBUPROFEN), withoutKey(after)]);
      // Re-dosed for the weight, with its maximum and settings, as the quick pick itself is.
      expect(latest[0]).toMatchObject({ dose: '9', dosing: { rate: 25, basis: 'mg/kg/dose' } });
      expect(screen.getByText('Prescription 3:')).toBeInTheDocument();
      expect(notices).toEqual([]);
    });

    it('never replaces a line that holds something: all the quick picks follow it, a drug already there again', async () => {
      const user = userEvent.setup();
      const held = withListedQuickPick(emptyPrescriptionLine(), SAVED_TEXT, WEIGHT.kg);
      render(<Form initial={[held]} />);
      await user.click(within(await openMenu(user)).getByText('Ear infection'));
      expect(latest.map(withoutKey)).toEqual([withoutKey(held), listed(BY_WEIGHT), listed(IBUPROFEN)]);
    });

    it('skips a quick pick that no longer exists and says so', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await user.click(within(await openMenu(user)).getByText('Acute otitis'));
      expect(latest.map(withoutKey)).toEqual([listed(IBUPROFEN), listed(BY_WEIGHT)]);
      expect(notices).toEqual(['1 prescription in this set no longer exists.']);
    });
  });

  describe('suggestions', () => {
    it('mixes the sets for the product in with its quick picks by name, three in all', () => {
      render(<Form initial={[amoxLine()]} />);
      // Acute otitis (set), Amox as written, Amox strep; Ear infection (set) is fourth. Bronchitis is Inactive.
      expect(screen.getAllByRole('button', { name: /^(Use this prescription|Write my own)$/ })).toHaveLength(4);
      const setRow = suggestionRow(0);
      expect(setRow).toHaveTextContent('Acute otitis');
      expect(within(setRow).getByText('Set · 2')).toBeInTheDocument();
      expect(suggestionRow(1)).toHaveTextContent('Take 5 mL by mouth twice daily for 10 days.');
      expect(suggestionRow(1)).not.toHaveTextContent('Set ·');
      expect(suggestionRow(2)).toHaveTextContent('Take 9 mL by mouth twice daily for 10 days.');
      expect(screen.queryByText('Ear infection')).not.toBeInTheDocument();
      expect(screen.queryByText('Bronchitis')).not.toBeInTheDocument();
    });

    it('shows the set’s quick pick for the product re-dosed, then what else it adds, with the row’s calculator and ⓘ', () => {
      render(<Form initial={[amoxLine()]} sets={[EAR_INFECTION]} />);
      // After the product's two quick picks, by name.
      const row = suggestionRow(2);
      // The calculator icon starts the row, then the set's name and chip, then the sentence.
      expect(within(row).getAllByRole('button')[0]).toHaveAccessibleName('Dose calculator for Amox strep');
      expect(row).toHaveTextContent(/^Ear infectionSet · 2Take 9 mL by mouth twice daily for 10 days\./);
      expect(
        within(row).getByText(
          'Also adds: Ibuprofen 100 mg/5ml Susp. Take 5 mL by mouth every 6 hours as needed for pain.'
        )
      ).toBeInTheDocument();
      expect(within(row).getByRole('img', { name: 'How this dose was worked out' })).toBeInTheDocument();
    });

    it('fills the line with the set’s quick pick for the product and adds the others after it', async () => {
      const user = userEvent.setup();
      render(<Form initial={[amoxLine()]} sets={[ACUTE_OTITIS]} />);
      await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Use this prescription' }));
      expect(latest).toHaveLength(2);
      // As the quick pick's own row fills it.
      expect(latest[0]).toMatchObject({
        medication: AMOX,
        drug: LIQUIDS,
        dose: '9',
        frequency: 'twice daily',
        durationDays: '10',
        noteToPharmacy: 'Shake well',
        patientInstructions: 'Take 9 mL by mouth twice daily for 10 days.',
        dosing: { rate: 25, basis: 'mg/kg/dose' },
      });
      expect(withoutKey(latest[1])).toEqual(listed(IBUPROFEN));
      expect(notices).toEqual(['1 prescription in this set no longer exists.']);
    });

    it('takes the first of several quick picks for the product, the others following', async () => {
      const user = userEvent.setup();
      render(<Form initial={[amoxLine()]} sets={[set('set-both', 'Both amox', ['qp-text', 'qp-strep'])]} />);
      const row = suggestionRow(2);
      expect(row).toHaveTextContent('Take 5 mL by mouth twice daily for 10 days.');
      expect(within(row).getByText(/^Also adds: Amoxicillin 400 mg\/5ml Susp. Take 9 mL/)).toBeInTheDocument();
      await user.click(within(row).getByRole('button', { name: 'Use this prescription' }));
      expect(latest[0]).toMatchObject({ patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.' });
      expect(withoutKey(latest[1])).toEqual(listed(BY_WEIGHT));
    });
  });

  it('words the missing quick picks for one and for more', () => {
    expect(missingSetMembersText(1)).toBe('1 prescription in this set no longer exists.');
    expect(missingSetMembersText(2)).toBe('2 prescriptions in this set no longer exist.');
  });
});
