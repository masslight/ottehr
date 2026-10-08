import { TextField } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { RadiologyPreliminaryReadSuggestions } from '../../src/features/radiology/components/RadiologyPreliminaryReadSuggestions';

const FIELD_LABEL = 'Preliminary Read';
const ADD_BTN_LABEL = 'Add to read';
const ADDED_LABEL = 'Added to read';

// The box only hands a sentence up; the page appends it to its own field state and passes the field back down.
// Mirror that here so the tests cover the append rule (newline-separated after existing text) end to end.
const Harness = ({
  cptCode,
  laterality,
  isChild = false,
  disabled,
}: {
  cptCode?: string;
  laterality?: 'LT' | 'RT' | '50';
  isChild?: boolean;
  disabled?: boolean;
}): JSX.Element => {
  const [read, setRead] = useState('');
  return (
    <>
      <RadiologyPreliminaryReadSuggestions
        cptCode={cptCode}
        laterality={laterality}
        isChild={isChild}
        disabled={disabled}
        value={read}
        onAdd={(sentence) => setRead((prev) => (prev.trim() ? `${prev.trim()}\n${sentence}` : sentence))}
      />
      <TextField label={FIELD_LABEL} multiline value={read} onChange={(e) => setRead(e.target.value)} />
    </>
  );
};

describe('RadiologyPreliminaryReadSuggestions', () => {
  it('renders the region templates for a mapped CPT and nothing for an unmapped one or when disabled', () => {
    const { unmount } = render(<Harness cptCode="73610" laterality="LT" />);
    expect(screen.getByText('Suggested reads')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: ADD_BTN_LABEL })).toHaveLength(2);
    unmount();

    const unmapped = render(<Harness cptCode="99999" />);
    expect(screen.queryByText('Suggested reads')).not.toBeInTheDocument();
    unmapped.unmount();

    render(<Harness cptCode="73610" laterality="LT" disabled />);
    expect(screen.queryByText('Suggested reads')).not.toBeInTheDocument();
  });

  it('lets a blank be changed from the list, then appends the finished sentences to the field', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" isChild />);

    // Child: the ankle fracture type defaults to Salter-Harris I; swap the bone via the list.
    await user.click(screen.getByRole('button', { name: 'Bone: distal fibula (lateral malleolus)' }));
    const listbox = screen.getByRole('listbox', { name: 'Bone' });
    expect(within(listbox).getByText('Bone')).toBeInTheDocument();
    await user.click(within(listbox).getByRole('option', { name: 'medial malleolus' }));
    expect(screen.getByRole('button', { name: 'Bone: medial malleolus' })).toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', { name: ADD_BTN_LABEL });
    await user.click(addButtons[0]);
    await user.click(addButtons[1]);

    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'No acute fracture or dislocation. Ankle mortise intact. Growth plates appear normal.\n' +
        'Salter-Harris I fracture of the left medial malleolus. Growth plate not involved. Ankle mortise intact.'
    );
    // Both rows now show the added check, announced in place of the "+"; changing a blank re-arms its row.
    expect(screen.queryAllByRole('button', { name: ADD_BTN_LABEL })).toHaveLength(0);
    expect(screen.getAllByRole('img', { name: ADDED_LABEL })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Bone: medial malleolus' }));
    await user.click(screen.getByRole('option', { name: 'distal tibia' }));
    expect(screen.getAllByRole('button', { name: ADD_BTN_LABEL })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: ADDED_LABEL })).toHaveLength(1);
  });

  it('shows a row as added only while its sentence is still in the field, so it can be re-added after a clear', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" />);
    const field = screen.getByRole('textbox', { name: FIELD_LABEL });

    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[0]);
    expect(field).toHaveValue('No acute fracture or dislocation. Ankle mortise intact.');
    expect(screen.getAllByRole('img', { name: ADDED_LABEL })).toHaveLength(1);

    await user.clear(field);
    expect(screen.queryAllByRole('img', { name: ADDED_LABEL })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: ADD_BTN_LABEL })).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[0]);
    expect(field).toHaveValue('No acute fracture or dislocation. Ankle mortise intact.');
    expect(screen.getAllByRole('img', { name: ADDED_LABEL })).toHaveLength(1);
  });

  it('shows "(none)" on a blank left out and drops its text from the sentence', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" />);

    await user.click(screen.getByRole('button', { name: 'Closing line: Ankle mortise intact.' }));
    await user.click(screen.getByRole('option', { name: '(none)' }));
    expect(screen.getByRole('button', { name: 'Closing line: (none)' })).toHaveTextContent('(none)');

    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);
    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Nondisplaced fracture of the left distal fibula (lateral malleolus).'
    );
  });

  it('opens the list from a blank whose current value is (none), with (none) marked as current', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" isChild />);

    await user.click(screen.getByRole('button', { name: 'Soft tissue: (none)' }));
    const listbox = screen.getByRole('listbox', { name: 'Soft tissue' });
    expect(within(listbox).getByRole('option', { name: '(none)' })).toHaveAttribute('aria-selected', 'true');
    expect(
      within(listbox).getByRole('option', { name: 'Soft-tissue swelling over the lateral malleolus.' })
    ).toHaveAttribute('aria-selected', 'false');
  });

  it('shows the row text with single spaces where an adult-only gap was dropped, matching the added sentence', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73090" laterality="LT" />);

    // Adult forearm: the growth-plate blank between "radius." and the closing line is dropped from the template.
    const fractureRow = screen.getByText(/fracture of the left/);
    expect(fractureRow.textContent).toBe(
      'Nondisplaced fracture of the left distal radius. No dislocation. Alignment maintained.'
    );
    expect(screen.getByText('Alignment maintained.').textContent).toBe(
      'No acute fracture or dislocation. Alignment maintained. (none)'
    );

    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);
    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(fractureRow.textContent);
  });

  it('can be driven from the keyboard: Enter opens on the current value, arrows move, Enter picks, Escape returns', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" />);

    await user.tab();
    const blank = screen.getByRole('button', { name: 'Opening: No acute fracture or dislocation.' });
    expect(blank).toHaveFocus();
    await user.keyboard('{Enter}');
    const listbox = screen.getByRole('listbox', { name: 'Opening' });
    const [current, next] = within(listbox).getAllByRole('option');
    expect(current).toHaveAttribute('aria-selected', 'true');
    expect(current).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute('aria-selected', 'false');
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    const picked = screen.getByRole('button', { name: 'Opening: No acute osseous abnormality.' });
    expect(picked).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('listbox', { name: 'Opening' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(picked).toHaveFocus();
  });

  it.each([{ laterality: '50' as const }, { laterality: undefined }])(
    'blocks + until the side is picked when the order does not fix one (laterality $laterality)',
    async ({ laterality }) => {
      const user = userEvent.setup();
      render(<Harness cptCode="73610" laterality={laterality} />);

      // The negative read has no side; the fracture read does and starts on an empty placeholder.
      const [negativeAdd, fractureAdd] = screen.getAllByRole('button', { name: ADD_BTN_LABEL });
      expect(negativeAdd).toBeEnabled();
      expect(fractureAdd).toBeDisabled();
      const placeholder = screen.getByRole('button', { name: 'Side: not picked' });
      expect(placeholder).toHaveTextContent('side');

      await user.click(placeholder);
      const listbox = screen.getByRole('listbox', { name: 'Side' });
      expect(within(listbox).getByRole('option', { name: 'bilateral' })).toBeInTheDocument();
      await user.click(within(listbox).getByRole('option', { name: 'right' }));

      expect(screen.getByRole('button', { name: 'Side: right' })).toBeInTheDocument();
      expect(fractureAdd).toBeEnabled();
      await user.click(fractureAdd);
      expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
        'Nondisplaced fracture of the right distal fibula (lateral malleolus). Ankle mortise intact.'
      );
    }
  );
});
