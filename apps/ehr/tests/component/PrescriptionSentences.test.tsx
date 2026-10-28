import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
  withProduct,
  withSuggestion,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import {
  PrescriptionSentences,
  SAVE_QUICK_PICK_LABEL,
} from '../../src/features/visits/in-person/components/erx/PrescriptionSentences';
import { PrescriptionSuggestionRow } from '../../src/features/visits/in-person/components/erx/prescriptionSuggestions';
import { VisitWeight } from '../../src/features/visits/in-person/components/erx/useVisitWeight';
import { detailed } from './helpers/erxProducts';

/** One drug in every form, as the terminology search returns it. */
const AMOXICILLIN_DRUG = {
  name: 'Amoxicillin',
  strengths: [
    detailed({ strength: '250 mg Cap', ndcs: ['00093310701'] }),
    detailed({ strength: '875 mg Tab', ndcs: ['00093226401'] }),
    detailed({ strength: '250 mg/5ml Susp', ndcs: ['00093415573'] }),
  ],
};

// The suggestions come from the provider seam, empty in the app; a test sets `rows` to see the rows' behaviour.
const suggestions = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('../../src/features/visits/in-person/components/erx/prescriptionSuggestions', () => ({
  prescriptionSuggestionsFor: () => suggestions.rows,
}));
// The searches behind the medication and diagnosis popovers are network calls; the medication one answers with the
// drug above whatever is typed, and any `others` after it. A test sets `failed` to make the search request fail.
const medicationSearch = vi.hoisted(() => ({ failed: false, others: [] as unknown[] }));
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () =>
    medicationSearch.failed
      ? { data: undefined, isFetching: false, isError: true }
      : { data: [AMOXICILLIN_DRUG, ...medicationSearch.others], isFetching: false, isError: false },
}));
// A failed search offers the visit's Report Issue dialog, which reads the visit and the API clients.
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { resourceType: 'Encounter', id: 'encounter-1', status: 'in-progress' } }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: undefined }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => undefined }));
vi.mock('../../src/features/admin/patient-education/useIcd10SearchInput', () => ({
  useIcd10SearchInput: () => ({ inputValue: '', setInputValue: () => undefined, options: [], isFetching: false }),
}));

const Harness = ({
  initial,
  onRemove,
  onSaveQuickPick,
  weight,
  weightNote,
}: {
  initial: PrescriptionLine;
  onRemove?: () => void;
  onSaveQuickPick?: () => void;
  weight?: VisitWeight;
  weightNote?: string;
}): JSX.Element => {
  const [line, setLine] = useState(initial);
  return (
    <PrescriptionSentences
      line={line}
      index={0}
      onChange={setLine}
      onRemove={onRemove}
      quickPicks={[]}
      onQuickPick={() => undefined}
      onSaveQuickPick={onSaveQuickPick}
      visitDiagnoses={[]}
      weight={weight}
      weightNote={weightNote}
      errors={[]}
      readOnly={false}
    />
  );
};

const LIQUIDS = {
  name: 'Amoxicillin',
  strengths: [
    detailed({ strength: '400 mg/5ml Susp', ndcs: ['00093416173'] }),
    detailed({ strength: '250 mg/5ml Susp', ndcs: ['00093415573'] }),
  ],
};

/** A line as picking the drug's first strength leaves it. */
const lineFor = (drug: typeof LIQUIDS): PrescriptionLine =>
  withProduct(emptyPrescriptionLine(), drug, drug.strengths[0]);

/** What the test rows write: a whole course, as a suggestion would. */
const FIELDS = {
  dose: '5',
  route: 'by mouth' as const,
  frequency: 'twice daily',
  durationDays: '10',
  steps: [],
  instructions: '',
  quantityValue: '100',
  quantityUnit: 'Milliliter' as const,
  daysSupply: '10',
  numberOfRefills: '0',
  patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
};
const DOSED_ROW: PrescriptionSuggestionRow = {
  id: 'dosed',
  segments: ['Take 5 mL by mouth twice daily for 10 days.'],
  reason: '18 kg × 45 mg/kg/day ÷ 2 = 405 mg → 5 mL = 400 mg',
  fill: () => FIELDS,
  apply: (line) => withSuggestion(line, FIELDS),
};

const pickDrug = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: 'medication (empty)' }));
  await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'amox');
  await user.click(await screen.findByRole('option', { name: 'Amoxicillin' }));
};

/** Picks the drug, then a strength: the provider picks both. */
const pickAmoxicillin = async (user: ReturnType<typeof userEvent.setup>, strength = '250 mg Cap'): Promise<void> => {
  await pickDrug(user);
  await user.click(screen.getByRole('button', { name: 'strength (empty)' }));
  await user.click(screen.getByRole('option', { name: strength }));
};

/** Picks the suggestions' last row, "Other", which shows the line's blanks empty. */
const pickOther = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: 'Write my own' }));
};

/** Opens the suggestions box again: using a row or "Other" folds it to its title. */
const showSuggestions = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: 'Show suggestions' }));
};

/** Runs a test with these suggestion rows, then goes back to none. */
const withRows = (rows: PrescriptionSuggestionRow[], test: () => Promise<void>) => async (): Promise<void> => {
  suggestions.rows = rows;
  try {
    await test();
  } finally {
    suggestions.rows = [];
  }
};

const directionsShown = (): boolean => screen.queryByRole('textbox', { name: 'directions' }) !== null;

describe('PrescriptionSentences', () => {
  it('starts the line with its medication, unnumbered, and waits for one before suggesting anything', () => {
    render(<Harness initial={emptyPrescriptionLine()} />);
    expect(screen.queryByText(/Prescription \d:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'medication (empty)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'route (empty)' })).not.toBeInTheDocument();
    // Nothing shows above the sentence until a medication is picked.
    expect(screen.queryByText('Suggested prescriptions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this prescription' })).not.toBeInTheDocument();
  });

  it(
    'shows the suggestions above the line’s first sentence once a medication is picked',
    withRows([DOSED_ROW], async () => {
      const user = userEvent.setup();
      render(<Harness initial={emptyPrescriptionLine()} />);
      await pickAmoxicillin(user);
      const box = screen.getByText('Suggested prescriptions');
      const sentence = screen.getByRole('button', { name: /^medication/ });
      expect(box.compareDocumentPosition(sentence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    })
  );

  it('opens the line with its medication blank first, and no separate quick pick list', () => {
    render(<Harness initial={emptyPrescriptionLine()} />);
    const sentence = screen
      .getByRole('button', { name: 'medication (empty)' })
      .closest('.MuiTypography-root') as HTMLElement;
    expect(within(sentence).getAllByRole('button')[0]).toHaveAccessibleName('medication (empty)');
    expect(screen.queryByRole('button', { name: /quick pick/ })).not.toBeInTheDocument();
  });

  it(
    'leaves the strength for the provider to pick; the suggestions and the line wait for it',
    withRows([DOSED_ROW], async () => {
      const user = userEvent.setup();
      render(<Harness initial={emptyPrescriptionLine()} />);
      await pickDrug(user);
      expect(screen.getByRole('button', { name: 'medication: Amoxicillin' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'strength (empty)' })).toBeInTheDocument();
      expect(screen.queryByText('Suggested prescriptions')).not.toBeInTheDocument();
      expect(directionsShown()).toBe(false);

      await user.click(screen.getByRole('button', { name: 'strength (empty)' }));
      await user.click(screen.getByRole('option', { name: '250 mg/5ml Susp' }));
      expect(screen.getByText('Suggested prescriptions')).toBeInTheDocument();
      await pickOther(user);
      expect(screen.getByRole('button', { name: 'unit: milliliters' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'route: by mouth' })).toBeInTheDocument();
    })
  );

  it('opens a no-suggestion line only once the strength is picked', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    await pickDrug(user);
    expect(directionsShown()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'strength (empty)' }));
    await user.click(screen.getByRole('option', { name: '250 mg Cap' }));
    expect(directionsShown()).toBe(true);
    expect(screen.getByRole('button', { name: 'unit: capsules' })).toBeInTheDocument();
  });

  it('writes the directions and dispense details from the blanks, but never over typed directions', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    await pickAmoxicillin(user);
    await user.click(screen.getByRole('button', { name: 'strength: 250 mg Cap' }));
    await user.click(screen.getByRole('option', { name: '875 mg Tab' }));

    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '1');
    await user.click(screen.getByRole('button', { name: 'frequency (empty)' }));
    await user.click(screen.getByRole('option', { name: 'twice daily' }));
    await user.type(screen.getByRole('spinbutton', { name: 'duration' }), '10');

    const directions = screen.getByRole('textbox', { name: 'directions' });
    expect(directions).toHaveValue('Take 1 tablet by mouth twice daily for 10 days.');
    expect(screen.getByRole('spinbutton', { name: 'quantity' })).toHaveValue(20);
    expect(screen.getByRole('spinbutton', { name: 'days supply' })).toHaveValue(10);

    await user.type(directions, ' Take with food.');
    await user.click(screen.getByRole('button', { name: 'frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'three times daily' }));
    expect(directions).toHaveValue('Take 1 tablet by mouth twice daily for 10 days. Take with food.');
    expect(screen.getByRole('spinbutton', { name: 'quantity' })).toHaveValue(30);
  });

  it('adds a "then" step whose blanks join the directions and the quantity, until it is removed', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    await pickAmoxicillin(user);
    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '2');
    await user.click(screen.getByRole('button', { name: 'frequency (empty)' }));
    await user.click(screen.getByRole('option', { name: 'once daily' }));
    await user.type(screen.getByRole('spinbutton', { name: 'duration' }), '1');
    // The sentence's own unit follows the number, as the directions do (the input's value is not in the text).
    expect(screen.getByRole('spinbutton', { name: 'duration' }).closest('.MuiTypography-root')).toHaveTextContent(
      /for\s+day\./
    );

    await user.click(screen.getByRole('button', { name: '+ then (empty)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'step 2 dose' }), '1');
    await user.click(screen.getByRole('button', { name: 'step 2 frequency (empty)' }));
    await user.click(screen.getByRole('option', { name: 'once daily' }));
    await user.type(screen.getByRole('spinbutton', { name: 'step 2 duration' }), '4');
    expect(
      screen.getByRole('spinbutton', { name: 'step 2 duration' }).closest('.MuiTypography-root')
    ).toHaveTextContent(/for\s+days\./);

    const directions = screen.getByRole('textbox', { name: 'directions' });
    expect(directions).toHaveValue(
      'Take 2 capsules by mouth once daily for 1 day, then 1 capsule by mouth once daily for 4 days.'
    );
    expect(screen.getByRole('spinbutton', { name: 'quantity' })).toHaveValue(6);
    expect(screen.getByRole('spinbutton', { name: 'days supply' })).toHaveValue(5);
    // The links move to the last step; the route stays on the first.
    expect(screen.getAllByRole('button', { name: '+ then (empty)' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^route/ })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Remove step 2' }));
    expect(screen.queryByRole('spinbutton', { name: 'step 2 dose' })).not.toBeInTheDocument();
    expect(directions).toHaveValue('Take 2 capsules by mouth once daily for 1 day.');
    expect(screen.getByRole('spinbutton', { name: 'quantity' })).toHaveValue(2);

    await user.type(directions, ' Finish all.');
    await user.click(screen.getByRole('button', { name: '+ then (empty)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'step 2 dose' }), '1');
    expect(directions).toHaveValue('Take 2 capsules by mouth once daily for 1 day. Finish all.');
  });

  it('reads "as directed" without a dose and leaves the quantity to the provider', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    await pickAmoxicillin(user);
    await user.click(screen.getByRole('button', { name: 'frequency (empty)' }));
    await user.click(screen.getByRole('option', { name: 'as directed' }));
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue('Take by mouth as directed.');
    expect(screen.getByRole('spinbutton', { name: 'quantity' })).toHaveValue(null);
  });

  it('offers instructions as a link, appends what is typed, and clears them with a way back', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    await pickAmoxicillin(user);
    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '1');
    expect(screen.queryByRole('textbox', { name: 'instructions' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ instructions (empty)' }));
    expect(screen.queryByRole('button', { name: '+ instructions (empty)' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'instructions' }), 'with food');
    const directions = screen.getByRole('textbox', { name: 'directions' });
    expect(directions).toHaveValue('Take 1 capsule by mouth, with food.');

    await user.click(screen.getByRole('button', { name: 'Remove instructions' }));
    expect(screen.queryByRole('textbox', { name: 'instructions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ instructions (empty)' })).toBeInTheDocument();
    expect(directions).toHaveValue('Take 1 capsule by mouth.');
  });

  it('offers urgent as a link ending the Substitution sentence until it is wanted, then shows it with a way back', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    // Only once the line's details show.
    expect(screen.queryByRole('button', { name: '+ urgent (empty)' })).not.toBeInTheDocument();
    await pickAmoxicillin(user);
    expect(screen.queryByText('yes')).not.toBeInTheDocument();
    const substitution = (): Element | null =>
      screen.getByRole('button', { name: /^substitution/ }).closest('.MuiTypography-root');
    expect(substitution()).toHaveTextContent(/^Substitution allowed\u2060?\. \+ urgent$/);

    await user.click(screen.getByRole('button', { name: '+ urgent (empty)' }));
    expect(substitution()).toHaveTextContent(/^Substitution allowed\u2060?\. Urgent: yes$/);
    expect(substitution()).toContainElement(screen.getByRole('button', { name: 'Remove urgent' }));
    expect(screen.queryByRole('button', { name: '+ urgent (empty)' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove urgent' }));
    expect(screen.queryByText('yes')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ urgent (empty)' })).toBeInTheDocument();
  });

  it('puts "Save as quick pick" on its own row under the line’s last sentence, for admins only: the first until the rest shows', async () => {
    const user = userEvent.setup();
    const onSaveQuickPick = vi.fn();
    const { unmount } = render(<Harness initial={emptyPrescriptionLine()} onSaveQuickPick={onSaveQuickPick} />);
    const save = (): HTMLElement => screen.getByRole('button', { name: SAVE_QUICK_PICK_LABEL });
    const sentences = (): HTMLElement[] => screen.getAllByText(/./, { selector: '.MuiTypography-root' });
    /** In no sentence, and after the last one. */
    const underLastSentence = (): void => {
      expect(save().closest('.MuiTypography-root')).toBeNull();
      const all = sentences();
      expect(all[all.length - 1].compareDocumentPosition(save()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    };
    underLastSentence();
    expect(sentences()[sentences().length - 1]).toContainElement(screen.getByRole('button', { name: /^medication/ }));
    await user.click(save());
    expect(onSaveQuickPick).toHaveBeenCalledTimes(1);

    await pickAmoxicillin(user);
    underLastSentence();
    expect(sentences()[sentences().length - 1]).toHaveTextContent(/^Substitution/);
    expect(save()).toHaveClass('MuiButton-sizeSmall', 'MuiButton-text');
    expect(within(save()).getByTestId('SaveOutlinedIcon')).toBeInTheDocument();
    unmount();

    render(<Harness initial={emptyPrescriptionLine()} />);
    expect(screen.queryByRole('button', { name: SAVE_QUICK_PICK_LABEL })).not.toBeInTheDocument();
  });

  it('names the medication and diagnosis popups once: by their search fields, with no heading repeating them', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    // MUI repeats a field's label in its outline's hidden legend; that one isn't seen.
    const shown = (dialog: HTMLElement, text: string): HTMLElement[] =>
      within(dialog)
        .getAllByText(text)
        .filter((element) => !element.closest('legend'));
    await user.click(screen.getByRole('button', { name: 'medication (empty)' }));
    expect(shown(screen.getByRole('dialog', { name: 'Medication' }), 'Medication')).toHaveLength(1);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'add diagnosis (empty)' }));
    expect(shown(screen.getByRole('dialog', { name: 'Diagnosis' }), 'Diagnosis')).toHaveLength(1);
  });

  it('offers removal only when the page passes a remove handler', () => {
    const { unmount } = render(<Harness initial={emptyPrescriptionLine()} />);
    expect(screen.queryByRole('button', { name: 'Remove prescription 1' })).not.toBeInTheDocument();
    unmount();

    render(<Harness initial={emptyPrescriptionLine()} onRemove={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Remove prescription 1' })).toBeInTheDocument();
  });

  it('says the medication search is unavailable when the request fails, and offers the visit’s Report Issue dialog', async () => {
    medicationSearch.failed = true;
    try {
      const user = userEvent.setup();
      render(<Harness initial={emptyPrescriptionLine()} />);
      await user.click(screen.getByRole('button', { name: 'medication (empty)' }));
      await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'amox');
      expect(screen.queryByText('Nothing found for this search criteria')).not.toBeInTheDocument();
      await user.click(await screen.findByRole('button', { name: 'Report an issue' }));
      expect(await screen.findByText('Report Issue')).toBeInTheDocument();
    } finally {
      medicationSearch.failed = false;
    }
  });
});

describe('PrescriptionSentences: suggestions first', () => {
  it('opens a medication with no suggestions straight away: no box, no "Other"', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    await pickAmoxicillin(user);
    expect(screen.queryByText('Suggested prescriptions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Write my own' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(null);
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue('');
    // A new strength with none stays open too.
    await user.click(screen.getByRole('button', { name: 'strength: 250 mg Cap' }));
    await user.click(screen.getByRole('option', { name: '875 mg Tab' }));
    expect(directionsShown()).toBe(true);
  });

  it(
    'with suggestions, hides the line until a row or "Other" is picked',
    withRows([DOSED_ROW], async () => {
      const user = userEvent.setup();
      render(<Harness initial={lineFor(LIQUIDS)} weightNote="using weight 18 kg (previous visit, 10/8/2026)" />);
      expect(screen.getByText('Suggested prescriptions')).toBeInTheDocument();
      // An earlier visit's weight is named under the box's title.
      expect(screen.getByText('using weight 18 kg (previous visit, 10/8/2026)')).toBeInTheDocument();
      for (const name of ['dose', 'duration', 'quantity', 'days supply', 'refills']) {
        expect(screen.queryByRole('spinbutton', { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('button', { name: /^substitution/ })).not.toBeInTheDocument();
      expect(directionsShown()).toBe(false);

      await pickOther(user);
      expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(null);
      expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue('');
      expect(screen.queryByTitle('In use')).not.toBeInTheDocument();
    })
  );

  it(
    'shows a row with its working, "Other" last, and fills the line from it',
    withRows([DOSED_ROW], async () => {
      const user = userEvent.setup();
      render(<Harness initial={lineFor(LIQUIDS)} />);
      expect(screen.getByText(/^Because 18 kg × 45 mg\/kg\/day/)).toBeInTheDocument();
      const buttons = screen.getAllByRole('button', { name: /^(Use this prescription|Write my own)$/ });
      expect(buttons.at(-1)).toHaveAccessibleName('Write my own');

      await user.click(screen.getByRole('button', { name: 'Use this prescription' }));
      expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(5);
      expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(FIELDS.patientInstructions);
      await showSuggestions(user);
      expect(screen.getByTitle('In use')).toBeInTheDocument();

      // Editing a filled field re-arms the row.
      const quantity = screen.getByRole('spinbutton', { name: 'quantity' });
      await user.clear(quantity);
      await user.type(quantity, '150');
      expect(screen.queryByTitle('In use')).not.toBeInTheDocument();
    })
  );

  it(
    'hides the line again when the strength or the medication changes',
    withRows([DOSED_ROW], async () => {
      const user = userEvent.setup();
      render(<Harness initial={emptyPrescriptionLine()} />);
      await pickAmoxicillin(user);
      expect(directionsShown()).toBe(false);
      await pickOther(user);
      expect(directionsShown()).toBe(true);
      await user.click(screen.getByRole('button', { name: 'strength: 250 mg Cap' }));
      await user.click(screen.getByRole('option', { name: '875 mg Tab' }));
      expect(directionsShown()).toBe(false);
      await pickOther(user);
      await user.click(screen.getByRole('button', { name: 'medication: Amoxicillin' }));
      await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'amox');
      await user.click(await screen.findByRole('option', { name: 'Amoxicillin' }));
      // Picking the drug again starts its strength over too.
      expect(screen.getByRole('button', { name: 'strength (empty)' })).toBeInTheDocument();
      expect(directionsShown()).toBe(false);
    })
  );

  it(
    'a line hidden after a new strength can’t be sent until a pick',
    withRows([DOSED_ROW], async () => {
      let latest = lineFor(LIQUIDS);
      /** As the order form: the send check's errors under the line. */
      const Sending = (): JSX.Element => {
        const [line, setLine] = useState(latest);
        latest = line;
        return (
          <PrescriptionSentences
            line={line}
            index={0}
            onChange={setLine}
            quickPicks={[]}
            onQuickPick={() => undefined}
            visitDiagnoses={[]}
            errors={prescriptionLineErrors(line)}
            readOnly={false}
          />
        );
      };
      const user = userEvent.setup();
      render(<Sending />);
      await pickOther(user);
      await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '5');
      await user.click(screen.getByRole('button', { name: 'frequency (empty)' }));
      await user.click(screen.getByRole('option', { name: 'twice daily' }));
      await user.type(screen.getByRole('spinbutton', { name: 'quantity' }), '150');
      expect(prescriptionLineErrors(latest)).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'strength: 400 mg/5ml Susp' }));
      await user.click(screen.getByRole('option', { name: '250 mg/5ml Susp' }));
      expect(directionsShown()).toBe(false);
      expect(prescriptionLineErrors(latest)).toContain('Pick a suggestion or Write my own');
      expect(screen.getByText(/Pick a suggestion or Write my own/)).toBeInTheDocument();
      await pickOther(user);
      expect(directionsShown()).toBe(true);
      expect(prescriptionLineErrors(latest)).not.toContain('Pick a suggestion or Write my own');
    })
  );

  it(
    'a line hidden after a new strength can’t be saved as a quick pick until a pick',
    withRows([DOSED_ROW], async () => {
      const onSaveQuickPick = vi.fn();
      const user = userEvent.setup();
      render(<Harness initial={lineFor(LIQUIDS)} onSaveQuickPick={onSaveQuickPick} />);
      const saveOffered = (): boolean => screen.queryByRole('button', { name: SAVE_QUICK_PICK_LABEL }) !== null;
      await pickOther(user);
      expect(saveOffered()).toBe(true);
      await user.click(screen.getByRole('button', { name: 'strength: 400 mg/5ml Susp' }));
      await user.click(screen.getByRole('option', { name: '250 mg/5ml Susp' }));
      expect(saveOffered()).toBe(false);
      await pickOther(user);
      expect(saveOffered()).toBe(true);
      expect(onSaveQuickPick).not.toHaveBeenCalled();
    })
  );

  it(
    'offers urgent whenever the line could be sent: hidden only before a pick, while the send is blocked',
    withRows([DOSED_ROW], async () => {
      const user = userEvent.setup();
      let current: PrescriptionLine = emptyPrescriptionLine();
      const Sending = (): JSX.Element => {
        const [line, setLine] = useState(lineFor(LIQUIDS));
        current = line;
        return (
          <PrescriptionSentences
            line={line}
            index={0}
            onChange={setLine}
            quickPicks={[]}
            onQuickPick={() => undefined}
            visitDiagnoses={[]}
            errors={[]}
            readOnly={false}
          />
        );
      };
      render(<Sending />);
      const urgentOffered = (): boolean => screen.queryByRole('button', { name: '+ urgent (empty)' }) !== null;
      // A hidden line has no directions yet, or is marked as waiting for a pick (a new strength).
      expect(urgentOffered()).toBe(false);
      expect(prescriptionLineErrors(current)).toContain('Enter the directions');
      await user.click(screen.getByRole('button', { name: 'Use this prescription' }));
      expect(urgentOffered()).toBe(true);
      await user.click(screen.getByRole('button', { name: 'strength: 400 mg/5ml Susp' }));
      await user.click(screen.getByRole('option', { name: '250 mg/5ml Susp' }));
      expect(urgentOffered()).toBe(false);
      expect(prescriptionLineErrors(current)).toContain('Pick a suggestion or Write my own');
      await user.click(screen.getByRole('button', { name: 'Use this prescription' }));
      expect(prescriptionLineErrors(current)).toEqual([]);
      expect(urgentOffered()).toBe(true);
    })
  );

  it(
    'folds the suggestions to their title once a row is used, or "Other"; the title’s chevron toggles them',
    withRows([DOSED_ROW], async () => {
      const user = userEvent.setup();
      const { unmount } = render(<Harness initial={lineFor(LIQUIDS)} />);
      expect(screen.getByRole('button', { name: 'Hide suggestions' })).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByRole('button', { name: 'Use this prescription' }));
      expect(screen.getByRole('button', { name: 'Show suggestions' })).toHaveAttribute('aria-expanded', 'false');
      // Only the title line stays.
      expect(screen.getByText('Suggested prescriptions')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Write my own' })).not.toBeInTheDocument());
      await showSuggestions(user);
      expect(screen.getByRole('button', { name: 'Write my own' })).toBeInTheDocument();
      // The title itself toggles too.
      await user.click(screen.getByText('Suggested prescriptions'));
      expect(screen.getByRole('button', { name: 'Show suggestions' })).toBeInTheDocument();
      unmount();

      render(<Harness initial={lineFor(LIQUIDS)} />);
      await pickOther(user);
      expect(screen.getByRole('button', { name: 'Show suggestions' })).toHaveAttribute('aria-expanded', 'false');
    })
  );

  it(
    'opens the folded suggestions again for another medication, and for a new strength that hides the line for a pick',
    withRows([DOSED_ROW], async () => {
      medicationSearch.others = [
        { name: 'Mupirocin (Topical)', strengths: [detailed({ strength: '2% Ointment', ndcs: ['00093101042'] })] },
      ];
      const user = userEvent.setup();
      render(<Harness initial={lineFor(LIQUIDS)} />);
      await pickOther(user);
      await user.click(screen.getByRole('button', { name: 'strength: 400 mg/5ml Susp' }));
      await user.click(screen.getByRole('option', { name: '250 mg/5ml Susp' }));
      expect(directionsShown()).toBe(false);
      expect(screen.getByRole('button', { name: 'Hide suggestions' })).toHaveAttribute('aria-expanded', 'true');
      await pickOther(user);
      expect(screen.getByRole('button', { name: 'Show suggestions' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'medication: Amoxicillin' }));
      await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'mupi');
      await user.click(await screen.findByRole('option', { name: 'Mupirocin (Topical)' }));
      await user.click(screen.getByRole('button', { name: 'strength (empty)' }));
      await user.click(screen.getByRole('option', { name: '2% Ointment' }));
      expect(screen.getByRole('button', { name: 'Hide suggestions' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: 'Write my own' })).toBeInTheDocument();
      medicationSearch.others = [];
    })
  );

  it('opens a line that already has directions (a quick pick, an edited line) shown', () => {
    const { unmount } = render(
      <Harness initial={{ ...lineFor(LIQUIDS), patientInstructions: 'Take 5 mL by mouth twice daily.' }} />
    );
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue('Take 5 mL by mouth twice daily.');
    unmount();

    render(<Harness initial={{ ...lineFor(LIQUIDS), dose: '5' }} />);
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(5);
  });
});

describe('PrescriptionSentences: the dose', () => {
  it('is a normal blank with a calculator icon starting its sentence, which opens the calculator under the line only when clicked', async () => {
    const user = userEvent.setup();
    const weight: VisitWeight = { kg: 28.12, takenAt: '2026-10-08T14:00:00Z', thisVisit: true };
    render(<Harness initial={emptyPrescriptionLine()} weight={weight} />);
    await pickAmoxicillin(user);
    const dose = screen.getByRole('spinbutton', { name: 'dose' });
    const icon = screen.getByRole('button', { name: 'Dose calculator' });
    // Before "Take", the sentence's first thing.
    expect(dose.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(icon.parentElement?.firstElementChild).toBe(icon);
    await user.type(dose, '1');
    expect(screen.queryByRole('dialog', { name: 'Dose calculator' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'frequency (empty)' }));
    await user.click(screen.getByRole('option', { name: 'twice daily' }));

    await user.click(icon);
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('button', { name: 'frequency: twice daily' })).toBeInTheDocument();
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '25');
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent('Take 3 capsules by mouth twice daily.');
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    expect(screen.queryByRole('dialog', { name: 'Dose calculator' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(3);
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue('Take 3 capsules by mouth twice daily.');
  });

  it('keeps the nearest measurable dose on a new strength, with how far it is off behind the ⓘ', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} />);
    await pickAmoxicillin(user);
    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '3');
    expect(screen.queryByRole('img', { name: 'dose re-measured' })).not.toBeInTheDocument();
    // 3 × 250 mg = 750 mg: one 875 mg tablet, 17% over; no cut-off.
    await user.click(screen.getByRole('button', { name: 'strength: 250 mg Cap' }));
    await user.click(screen.getByRole('option', { name: '875 mg Tab' }));
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(1);
    await user.hover(screen.getByRole('img', { name: 'dose re-measured' }));
    expect(await screen.findByTestId('dose-note')).toHaveTextContent('1 tablet = 875 mg, 125 mg (17%) over 750 mg');
    // A dose typed over it is the provider's: the note goes.
    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '2');
    expect(screen.queryByRole('img', { name: 'dose re-measured' })).not.toBeInTheDocument();
  });
});
