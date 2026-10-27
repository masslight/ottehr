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

// The real suggestions seam: the rows here come from the quick picks and sets given.
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () => ({ data: [], isFetching: false, isError: false }),
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
    { strength: '400 mg/5ml Susp', ndcs: ['00093416173'] },
    { strength: '250 mg/5ml Susp', ndcs: ['00093415573'] },
  ],
};
const AMOX = { ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp' };
const WEIGHT: VisitWeight = { kg: 28.12, takenAt: '2026-10-08T14:00:00Z', thisVisit: true };

const BY_WEIGHT: PrescriptionQuickPickData = {
  id: 'qp-strep',
  name: 'Amox strep',
  ndc: AMOX.ndc,
  medicationDescription: AMOX.description,
  quantityValue: 120,
  quantityUnit: 'Milliliter',
  daysSupply: 10,
  numberOfRefills: 0,
  substitutionAllowed: false,
  noteToPharmacy: 'Shake well',
  dosing: { rate: 25, basis: 'mg/kg/dose', dosesPerDay: 2, frequency: 'twice daily', durationDays: 10 },
};
const SAVED_TEXT: PrescriptionQuickPickData = {
  id: 'qp-text',
  name: 'Amox as written',
  ndc: AMOX.ndc,
  medicationDescription: AMOX.description,
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
  sets = SETS,
  weight = WEIGHT,
}: {
  initial: PrescriptionLine[];
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
          quickPicks={QUICK_PICKS}
          onQuickPick={(quickPick) =>
            setLines((current) =>
              current.map((item) => (item.key === line.key ? withListedQuickPick(line, quickPick, weightKg) : item))
            )
          }
          sets={sets}
          onSet={(picked, used) => {
            const { lines: next, missing } = withPrescriptionSet(line, picked, QUICK_PICKS, weightKg, used);
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

const openQuickPicks = async (user: ReturnType<typeof userEvent.setup>, index = 0): Promise<HTMLElement> => {
  await user.click(screen.getAllByRole('button', { name: '+ quick pick (empty)' })[index]);
  return screen.getByRole('listbox', { name: 'Quick pick' });
};

describe('Prescription sets on the order form', () => {
  beforeEach(() => {
    notices.length = 0;
  });

  describe('the "+ quick pick" list', () => {
    it('lists the Active sets under "Sets", with their products, above the quick picks under "Prescriptions"', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      const list = await openQuickPicks(user);
      expect(
        Array.from(list.children).map(
          (item) => item.querySelector('.MuiListItemText-primary')?.textContent ?? item.textContent
        )
      ).toEqual([
        'Sets',
        'Acute otitis',
        'Ear infection',
        'Prescriptions',
        'Amox as written, 100 milliliter',
        'Amox strep, 120 milliliter',
        'Ibuprofen pain, 120 milliliter',
      ]);
      expect(within(list).getByText('Ibuprofen 100 mg/5ml Susp, Amoxicillin 400 mg/5ml Susp')).toBeInTheDocument();
      expect(within(list).getByText('Amoxicillin 400 mg/5ml Susp, Ibuprofen 100 mg/5ml Susp')).toBeInTheDocument();
      // Inactive: waiting for review in Admin.
      expect(within(list).queryByText('Bronchitis')).not.toBeInTheDocument();
    });

    it('has no headings without an Active set', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} sets={[RETIRED]} />);
      const list = await openQuickPicks(user);
      expect(within(list).queryByText('Sets')).not.toBeInTheDocument();
      expect(within(list).queryByText('Prescriptions')).not.toBeInTheDocument();
    });

    it('fills an empty line with the first quick pick and adds the rest after it, each as if picked itself', async () => {
      const user = userEvent.setup();
      const after = withListedQuickPick(emptyPrescriptionLine(), SAVED_TEXT, WEIGHT.kg);
      render(<Form initial={[emptyPrescriptionLine(), after]} />);
      await user.click(within(await openQuickPicks(user)).getByText('Ear infection'));
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
      await user.click(screen.getByRole('button', { name: '+ quick pick (empty)' }));
      await user.click(within(screen.getByRole('listbox', { name: 'Quick pick' })).getByText('Ear infection'));
      expect(latest.map(withoutKey)).toEqual([withoutKey(held), listed(BY_WEIGHT), listed(IBUPROFEN)]);
    });

    it('skips a quick pick that no longer exists and says so', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await user.click(within(await openQuickPicks(user)).getByText('Acute otitis'));
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
        dosing: { rate: 25, basis: 'mg/kg/dose', dosesPerDay: 2 },
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
