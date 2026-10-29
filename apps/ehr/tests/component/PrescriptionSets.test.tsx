import { render, screen, waitFor, within } from '@testing-library/react';
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
// with the liquids below whatever is typed; a test sets `fetching` to see it still searching, `failed` to see it fail
// and `empty` to see it find nothing.
const medicationSearch = vi.hoisted(() => ({ fetching: false, failed: false, empty: false }));
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () =>
    medicationSearch.fetching
      ? { data: undefined, isFetching: true, isError: false }
      : medicationSearch.failed
      ? { data: undefined, isFetching: false, isError: true }
      : { data: medicationSearch.empty ? [] : [LIQUIDS], isFetching: false, isError: false },
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

const openMenu = async (user: ReturnType<typeof userEvent.setup>, index = 0): Promise<void> => {
  await user.click(screen.getAllByRole('button', { name: /^medication/ })[index]);
};
const field = (): HTMLElement => screen.getByRole('combobox', { name: 'Medication' });
const quickPickColumn = (): HTMLElement => screen.getByRole('listbox', { name: 'Prescription sets and quick picks' });
const medicationColumn = (): HTMLElement => screen.getByRole('listbox', { name: 'Medications' });
/** The medications column once the search for what's typed has returned (after the debounce's wait). */
const searchedColumn = async (): Promise<HTMLElement> => {
  await waitFor(() => expect(screen.queryByText('Searching medications…')).not.toBeInTheDocument());
  return medicationColumn();
};

/** The column's rows as read: a set's "Set: name", a quick pick's name, a medication's name. */
const menuItems = (list: HTMLElement): string[] =>
  Array.from(list.querySelectorAll('[role="option"]')).map((item) => item.textContent ?? '');
/** The row the field says is highlighted. */
const highlighted = (): string | null | undefined => {
  const id = field().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id)?.textContent : undefined;
};

const SETS_ROWS = ['Set: Acute otitis', 'Set: Ear infection'];
const AMOX_ROWS = ['Amox as written', 'Amox strep'];
const IBUPROFEN_ROW = 'Ibuprofen pain';

describe('Prescription sets on the order form', () => {
  beforeEach(() => {
    notices.length = 0;
  });

  describe('the medication menu', () => {
    it('before typing: a prompt to search medications on the left, the Active sets and quick picks on the right', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      expect(field()).toHaveAttribute('placeholder', 'Select a quick pick or type to search');
      expect(menuItems(within(quickPickColumn()).getByRole('group', { name: 'Prescription sets' }))).toEqual(SETS_ROWS);
      expect(menuItems(within(quickPickColumn()).getByRole('group', { name: 'Quick picks' }))).toEqual([
        ...AMOX_ROWS,
        IBUPROFEN_ROW,
      ]);
      // Quick picks' and sets' names italic; "Set:" muted, not italic.
      expect(screen.getByText('Amox strep')).toHaveStyle({ fontStyle: 'italic' });
      expect(screen.getByText('Acute otitis')).toHaveStyle({ fontStyle: 'italic' });
      expect(screen.getAllByText('Set:')[0]).not.toHaveStyle({ fontStyle: 'italic' });
      // Inactive: waiting for review in Admin.
      expect(screen.queryByText('Bronchitis')).not.toBeInTheDocument();
      expect(screen.queryByText('Type to search more')).not.toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
      expect(menuItems(medicationColumn())).toEqual(['+ compound']);
      expect(within(medicationColumn()).getByText(/^Type to search medications or/)).toBeInTheDocument();
      // The medications come first, on the left (and on top when the columns stack).
      expect(
        medicationColumn().compareDocumentPosition(quickPickColumn()) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      // The field names the two lists it drives.
      expect(field().getAttribute('aria-controls')?.split(' ')).toEqual([medicationColumn().id, quickPickColumn().id]);
    });

    it('lists up to 10 quick picks and 10 sets after them before anything is typed, then says to type for more', async () => {
      const user = userEvent.setup();
      const many = Array.from({ length: 12 }, (_, i) => ({ ...IBUPROFEN, id: `qp-${i}`, name: `Pick ${10 + i}` }));
      const sets = Array.from({ length: 11 }, (_, i) => set(`set-${i}`, `Set ${10 + i}`, ['qp-0']));
      render(<Form initial={[emptyPrescriptionLine()]} quickPicks={many} sets={sets} />);
      await openMenu(user);
      const items = menuItems(quickPickColumn());
      expect(items).toHaveLength(10 + 10);
      expect(items[0]).toBe('Pick 10');
      expect(items[9]).toBe('Pick 19');
      expect(items[10]).toBe('Set: Set 10');
      expect(items[19]).toBe('Set: Set 19');
      expect(screen.getByText('Type to search more')).toBeInTheDocument();
      expect(screen.queryByText('Set 20')).not.toBeInTheDocument();
      expect(screen.queryByText('Pick 20')).not.toBeInTheDocument();
      // Typed, every match shows: past the first 10.
      await user.type(field(), 'pick 2');
      expect(screen.getByText('Pick 20')).toBeInTheDocument();
      expect(screen.getByText('Pick 21')).toBeInTheDocument();
      expect(screen.queryByText('Type to search more')).not.toBeInTheDocument();
    });

    it('typed: the search’s medications on the left, the matching quick picks and then sets on the right', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      // "amox" matches the amoxicillin quick picks by name and both sets by one of theirs; not the ibuprofen.
      await user.type(field(), 'amox');
      expect(menuItems(quickPickColumn())).toEqual([...AMOX_ROWS, ...SETS_ROWS]);
      expect(menuItems(await searchedColumn())).toEqual(['Amoxicillin', '+ compound starting with Amoxicillin']);
      expect(screen.getByText('Amoxicillin')).not.toHaveStyle({ fontStyle: 'italic' });
      // By product, in any case: both sets hold the ibuprofen.
      await user.clear(field());
      await user.type(field(), 'IBUPROFEN 100');
      expect(menuItems(quickPickColumn())).toEqual([IBUPROFEN_ROW, ...SETS_ROWS]);
      // A set matched by its own name only: no quick picks heading.
      await user.clear(field());
      await user.type(field(), 'otitis');
      expect(menuItems(quickPickColumn())).toEqual([SETS_ROWS[0]]);
      expect(within(quickPickColumn()).queryByRole('group', { name: 'Quick picks' })).not.toBeInTheDocument();
      // A quick pick only: no sets heading.
      await user.clear(field());
      await user.type(field(), 'written');
      expect(menuItems(quickPickColumn())).toEqual(['Amox as written']);
      expect(within(quickPickColumn()).queryByRole('group', { name: 'Prescription sets' })).not.toBeInTheDocument();
      // No quick picks; the search still answers.
      await user.clear(field());
      await user.type(field(), 'zz');
      expect(menuItems(quickPickColumn())).toEqual([]);
      expect(screen.getByText('No quick picks match')).toBeInTheDocument();
      expect(menuItems(await searchedColumn())).toEqual(['Amoxicillin', '+ compound starting with Amoxicillin']);
      // One letter is too few for the medication search.
      await user.clear(field());
      await user.type(field(), 'w');
      expect(menuItems(quickPickColumn())).toEqual(['Amox as written']);
      expect(menuItems(medicationColumn())).toEqual(['+ compound']);
      expect(within(medicationColumn()).getByText(/^Type to search medications or/)).toBeInTheDocument();
    });

    it('says "Searching medications…" from the first keystroke, through the debounce’s wait, until the search returns', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      await user.type(field(), 'am');
      // The search for "am" hasn't been sent yet: not the last search's answer, and not "nothing found".
      expect(screen.getByText('Searching medications…')).toBeInTheDocument();
      expect(menuItems(medicationColumn())).toEqual([]);
      expect(screen.queryByText(/^Nothing found for this search criteria/)).not.toBeInTheDocument();
      expect(await within(medicationColumn()).findByRole('option', { name: 'Amoxicillin' })).toBeInTheDocument();
      expect(screen.queryByText('Searching medications…')).not.toBeInTheDocument();
      // A keystroke more searches again: the answer for "am" isn't shown as the one for "amo".
      await user.type(field(), 'o');
      expect(screen.getByText('Searching medications…')).toBeInTheDocument();
      expect(menuItems(medicationColumn())).toEqual([]);
      expect(menuItems(await searchedColumn())).toEqual(['Amoxicillin', '+ compound starting with Amoxicillin']);
    });

    it('says "Searching medications…" while the request runs, the quick picks already matching', async () => {
      medicationSearch.fetching = true;
      try {
        const user = userEvent.setup();
        render(<Form initial={[emptyPrescriptionLine()]} />);
        await openMenu(user);
        await user.type(field(), 'ibu');
        // Past the debounce: the request itself is still running.
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(menuItems(quickPickColumn())).toEqual([IBUPROFEN_ROW, ...SETS_ROWS]);
        expect(menuItems(medicationColumn())).toEqual([]);
        expect(screen.getByText('Searching medications…')).toBeInTheDocument();
      } finally {
        medicationSearch.fetching = false;
      }
    });

    it('says the search is unavailable when it fails, the quick picks still there', async () => {
      medicationSearch.failed = true;
      try {
        const user = userEvent.setup();
        render(<Form initial={[emptyPrescriptionLine()]} />);
        await openMenu(user);
        await user.type(field(), 'amox');
        expect(menuItems(quickPickColumn())).toEqual([...AMOX_ROWS, ...SETS_ROWS]);
        expect(
          await within(medicationColumn().parentElement!).findByText('Medication search is unavailable.')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Report an issue' })).toBeInTheDocument();
        expect(screen.queryByText(/^Nothing found for this search criteria/)).not.toBeInTheDocument();
      } finally {
        medicationSearch.failed = false;
      }
    });

    it('says when the search finds nothing, only once it has returned', async () => {
      medicationSearch.empty = true;
      try {
        const user = userEvent.setup();
        render(<Form initial={[emptyPrescriptionLine()]} />);
        await openMenu(user);
        await user.type(field(), 'amox');
        expect(screen.queryByText(/^Nothing found for this search criteria/)).not.toBeInTheDocument();
        expect(await screen.findByText(/^Nothing found for this search criteria ·/)).toBeInTheDocument();
        expect(menuItems(medicationColumn())).toEqual(['+ compound']);
      } finally {
        medicationSearch.empty = false;
      }
    });

    it('keeps the popup’s size whatever the columns hold: empty, searching, results, nothing found', async () => {
      medicationSearch.empty = true;
      try {
        const user = userEvent.setup();
        render(<Form initial={[emptyPrescriptionLine()]} />);
        await openMenu(user);
        const sizes = (): string[] => {
          const popup = getComputedStyle(screen.getByRole('dialog', { name: 'Medication' }));
          const columns = [medicationColumn(), quickPickColumn()].map((list) => getComputedStyle(list.parentElement!));
          return [popup.width, ...columns.flatMap((column) => [column.height, column.maxHeight, column.overflowY])];
        };
        const before = sizes();
        // A fixed height for both columns, each scrolling inside it, and a fixed width.
        expect(before[0]).not.toBe('');
        expect(before.slice(1, 4)).toEqual(before.slice(4));
        expect(before[1]).toMatch(/^\d+px$/);
        expect(before[3]).toBe('auto');
        await user.type(field(), 'am');
        expect(screen.getByText('Searching medications…')).toBeInTheDocument();
        expect(sizes()).toEqual(before);
        expect(await screen.findByText(/^Nothing found for this search criteria/)).toBeInTheDocument();
        expect(sizes()).toEqual(before);
        await user.type(field(), 'zz');
        expect(screen.getByText('No quick picks match')).toBeInTheDocument();
        expect(sizes()).toEqual(before);
      } finally {
        medicationSearch.empty = false;
      }
    });

    it('the mouse highlights a row without scrolling anything or changing any row’s size', async () => {
      // jsdom has no scrollIntoView: a stand-in sees any call.
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      const scrollTop = vi.spyOn(Element.prototype, 'scrollTop', 'set');
      try {
        const user = userEvent.setup();
        render(<Form initial={[emptyPrescriptionLine()]} />);
        await openMenu(user);
        const rows = within(quickPickColumn()).getAllByRole('option');
        for (const row of rows) {
          await user.hover(row);
          expect(row).toHaveAttribute('aria-selected', 'true');
        }
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(scrollTop).not.toHaveBeenCalled();
        // The highlight is a background only.
        const box = (row: HTMLElement): string[] => {
          const style = getComputedStyle(row);
          return ['padding', 'margin', 'border', 'fontWeight', 'fontSize', 'lineHeight', 'height'].map((property) =>
            style.getPropertyValue(property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`))
          );
        };
        const lit = rows[rows.length - 1];
        expect(lit).toHaveAttribute('aria-selected', 'true');
        expect(box(lit)).toEqual(box(rows[2]));
        expect(getComputedStyle(lit).backgroundColor).not.toBe(getComputedStyle(rows[2]).backgroundColor);
      } finally {
        scrollTop.mockRestore();
        delete (Element.prototype as Partial<Element>).scrollIntoView;
      }
    });

    it('keyboard: Up/Down within a column, Left/Right between them, Enter picks, focus staying in the field', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      await user.type(field(), 'amox');
      await searchedColumn();
      expect(highlighted()).toBeUndefined();
      await user.keyboard('{ArrowDown}');
      expect(highlighted()).toBe('Amoxicillin');
      expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Amoxicillin');
      // "+ compound" is the column's last row; Down from it goes round to the top.
      await user.keyboard('{ArrowDown}');
      expect(highlighted()).toBe('+ compound starting with Amoxicillin');
      await user.keyboard('{ArrowDown}');
      expect(highlighted()).toBe('Amoxicillin');
      await user.keyboard('{ArrowRight}');
      expect(highlighted()).toBe(AMOX_ROWS[0]);
      await user.keyboard('{ArrowDown}');
      expect(highlighted()).toBe(AMOX_ROWS[1]);
      // Back to the medications: the nearest row there, the last one.
      await user.keyboard('{ArrowLeft}');
      expect(highlighted()).toBe('+ compound starting with Amoxicillin');
      await user.keyboard('{ArrowUp}');
      expect(highlighted()).toBe('Amoxicillin');
      await user.keyboard('{ArrowRight}');
      expect(highlighted()).toBe(AMOX_ROWS[0]);
      // Up from the top goes round to the bottom: the last set.
      await user.keyboard('{ArrowUp}');
      expect(highlighted()).toBe(SETS_ROWS[1]);
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(highlighted()).toBe('Amox strep');
      expect(field()).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(withoutKey(latest[0])).toEqual(listed(BY_WEIGHT));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('keyboard: before typing, Down starts in the quick picks; Enter on a medication picks it', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      await user.click(field());
      await user.keyboard('{ArrowDown}');
      expect(highlighted()).toBe(AMOX_ROWS[0]);
      // "+ compound" is a Left away.
      await user.keyboard('{ArrowLeft}');
      expect(highlighted()).toBe('+ compound');
      // Typing clears the highlight.
      await user.type(field(), 'amox');
      expect(highlighted()).toBeUndefined();
      await searchedColumn();
      await user.keyboard('{ArrowDown}{Enter}');
      expect(latest[0]).toMatchObject({ drug: LIQUIDS, medication: null });
    });

    it('picks a medication from the search as before: its strength next', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      await user.type(field(), 'amox');
      await user.click(await within(medicationColumn()).findByRole('option', { name: 'Amoxicillin' }));
      expect(latest[0]).toMatchObject({ drug: LIQUIDS, medication: null });
      expect(screen.getByRole('button', { name: 'strength (empty)' })).toBeInTheDocument();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('picks a quick pick as before: the line as the quick pick fills it', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      await user.click(within(quickPickColumn()).getByText('Amox as written'));
      expect(withoutKey(latest[0])).toEqual(listed(SAVED_TEXT));
      expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
        'Take 5 mL by mouth twice daily for 10 days.'
      );
    });

    it('fills an empty line with the first quick pick and adds the rest after it, each as if picked itself', async () => {
      const user = userEvent.setup();
      const after = withListedQuickPick(emptyPrescriptionLine(), SAVED_TEXT, WEIGHT.kg);
      render(<Form initial={[emptyPrescriptionLine(), after]} />);
      await openMenu(user);
      await user.click(within(quickPickColumn()).getByText('Ear infection'));
      expect(latest.map(withoutKey)).toEqual([listed(BY_WEIGHT), listed(IBUPROFEN), withoutKey(after)]);
      // Re-dosed for the weight, with its maximum and settings, as the quick pick itself is.
      expect(latest[0]).toMatchObject({ dose: '9', dosing: { rate: 25, basis: 'mg/kg/dose' } });
      expect(screen.getAllByRole('button', { name: /^medication/ })).toHaveLength(3);
      expect(notices).toEqual([]);
    });

    it('never replaces a line that holds something: all the quick picks follow it, a drug already there again', async () => {
      const user = userEvent.setup();
      const held = withListedQuickPick(emptyPrescriptionLine(), SAVED_TEXT, WEIGHT.kg);
      render(<Form initial={[held]} />);
      await openMenu(user);
      await user.click(within(quickPickColumn()).getByText('Ear infection'));
      expect(latest.map(withoutKey)).toEqual([withoutKey(held), listed(BY_WEIGHT), listed(IBUPROFEN)]);
    });

    it('skips a quick pick that no longer exists and says so', async () => {
      const user = userEvent.setup();
      render(<Form initial={[emptyPrescriptionLine()]} />);
      await openMenu(user);
      await user.click(within(quickPickColumn()).getByText('Acute otitis'));
      expect(latest.map(withoutKey)).toEqual([listed(IBUPROFEN), listed(BY_WEIGHT)]);
      expect(notices).toEqual(['1 prescription in this set no longer exists.']);
    });
  });

  describe('suggestions', () => {
    it('lists the product’s quick picks first and its sets after them, three in all', () => {
      render(<Form initial={[amoxLine()]} />);
      // Amox as written, Amox strep, then Acute otitis (set); Ear infection (set) is fourth. Bronchitis is Inactive.
      expect(screen.getAllByRole('button', { name: /^(Use this prescription|Write my own)$/ })).toHaveLength(4);
      expect(suggestionRow(0)).toHaveTextContent('Take 5 mL by mouth twice daily for 10 days.');
      expect(suggestionRow(0)).not.toHaveTextContent('Set ·');
      expect(suggestionRow(1)).toHaveTextContent('Take 9 mL by mouth twice daily for 10 days.');
      expect(suggestionRow(1)).not.toHaveTextContent('Set ·');
      const setRow = suggestionRow(2);
      expect(setRow).toHaveTextContent('Acute otitis');
      expect(within(setRow).getByText('Set · 2')).toBeInTheDocument();
      expect(screen.queryByText('Ear infection')).not.toBeInTheDocument();
      expect(screen.queryByText('Bronchitis')).not.toBeInTheDocument();
    });

    it('shows the set’s quick pick for the product re-dosed, then what else it adds, with the row’s calculator and ⓘ', () => {
      render(<Form initial={[amoxLine()]} sets={[EAR_INFECTION]} />);
      // After the product's two quick picks.
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
      // After the product's two quick picks.
      await user.click(within(suggestionRow(2)).getByRole('button', { name: 'Use this prescription' }));
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
