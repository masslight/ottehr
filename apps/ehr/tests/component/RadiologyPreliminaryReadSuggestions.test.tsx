import { TextField } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { appendToPreliminaryRead } from 'utils/lib/helpers/radiology/preliminaryReadSuggestions';
import { describe, expect, it } from 'vitest';
import { RadiologyPreliminaryReadSuggestions } from '../../src/features/radiology/components/RadiologyPreliminaryReadSuggestions';

const FIELD_LABEL = 'Preliminary Read';
const ADD_BTN_LABEL = /^Add to read: /;
const ADDED_LABEL = /^Added to read: /;

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
        onAdd={(sentence) => setRead((prev) => appendToPreliminaryRead(prev, sentence))}
      />
      <TextField label={FIELD_LABEL} multiline value={read} onChange={(e) => setRead(e.target.value)} />
    </>
  );
};

describe('RadiologyPreliminaryReadSuggestions', () => {
  it('renders the region templates for a mapped CPT and nothing for an unmapped one or when disabled', () => {
    const { unmount } = render(<Harness cptCode="73610" laterality="LT" />);
    expect(screen.getByText('Suggested reads')).toBeInTheDocument();
    // Screen readers can tell the rows' buttons apart by the sentence each one adds.
    expect(screen.getAllByRole('button', { name: ADD_BTN_LABEL }).map((button) => button.ariaLabel)).toEqual([
      'Add to read: Negative',
      'Add to read: Fracture',
    ]);
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

    // Child ankle: the fracture starts on Salter-Harris I and the most common bone; the bone is swapped via the list.
    await user.click(screen.getByRole('button', { name: 'Bone: distal fibula (lateral malleolus)' }));
    const listbox = screen.getByRole('listbox', { name: 'Bone' });
    expect(within(listbox).getByText('Bone')).toBeInTheDocument();
    await user.click(within(listbox).getByRole('option', { name: 'medial malleolus' }));
    expect(screen.getByRole('button', { name: 'Bone: medial malleolus' })).toBeInTheDocument();

    const addButtons = screen.getAllByRole('button', { name: ADD_BTN_LABEL });
    await user.click(addButtons[0]);
    await user.click(addButtons[1]);

    // The growth-plate line next to Salter-Harris starts empty; the negative read keeps its pre-filled one.
    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'No acute fracture or dislocation. Ankle mortise intact. Growth plates appear normal.\n' +
        'Salter-Harris I fracture of the left medial malleolus. Ankle mortise intact.'
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

  it('shows a blank left out as "+ <field>" and drops its text from the sentence', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" />);

    await user.click(screen.getByRole('button', { name: 'Closing line: Ankle mortise intact.' }));
    await user.click(screen.getByRole('option', { name: '(none)' }));
    const closingLine = screen.getByRole('button', { name: 'Closing line: (none)' });
    expect(closingLine).toHaveTextContent('+ closing line');
    // A picked value gets a check mark; a field left empty does not, even when the provider emptied it.
    expect(within(closingLine).queryByTestId('CheckCircleIcon')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Opening: No acute fracture or dislocation.' }));
    await user.click(screen.getByRole('option', { name: 'No acute osseous abnormality.' }));
    expect(
      within(screen.getByRole('button', { name: 'Opening: No acute osseous abnormality.' })).getByTestId(
        'CheckCircleIcon'
      )
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);
    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Nondisplaced fracture of the left distal fibula (lateral malleolus).'
    );
  });

  it('lets a field that starts empty be filled and then set back to (none)', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73100" laterality="LT" />);
    const fractureRow = screen.getByText(/fracture of the left/);

    // Optional field that starts empty.
    await user.click(screen.getAllByRole('button', { name: 'Fracture type: (none)' })[0]);
    await user.click(screen.getByRole('option', { name: 'avulsion' }));
    // Displacement went empty on its own because a type is set; pick one, then set it back to (none).
    await user.click(screen.getAllByRole('button', { name: 'Displacement: (none)' })[0]);
    await user.click(screen.getByRole('option', { name: 'Displaced' }));
    expect(fractureRow.textContent).toMatch(/^Displaced avulsion fracture/);
    await user.click(screen.getAllByRole('button', { name: 'Displacement: Displaced' })[0]);
    await user.click(screen.getByRole('option', { name: '(none)' }));
    await user.click(screen.getAllByRole('button', { name: 'Fracture type: avulsion' })[0]);
    await user.click(screen.getByRole('option', { name: '(none)' }));

    expect(screen.getAllByRole('button', { name: 'Fracture type: (none)' })[0]).toHaveTextContent('+ fracture type');
    expect(screen.getAllByRole('button', { name: 'Displacement: (none)' })[0]).toHaveTextContent('+ displacement');
    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);
    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Fracture of the left distal radius. No dislocation. Alignment maintained.'
    );
  });

  it('opens the list from a blank whose current value is (none), with (none) marked as current', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73560" laterality="LT" />);

    // Two empty fields side by side (knee negative read) are told apart by their names.
    // Rows: negative, fracture; both have a joint effusion blank, the first is the negative read's.
    expect(screen.getAllByRole('button', { name: 'Joint effusion: (none)' })[0]).toHaveTextContent('+ joint effusion');
    expect(screen.getByRole('button', { name: 'Incidental finding: (none)' })).toHaveTextContent(
      '+ incidental finding'
    );

    await user.click(screen.getAllByRole('button', { name: 'Joint effusion: (none)' })[0]);
    const listbox = screen.getByRole('listbox', { name: 'Joint effusion' });
    expect(within(listbox).getByRole('option', { name: '(none)' })).toHaveAttribute('aria-selected', 'true');
    expect(within(listbox).getByRole('option', { name: 'Joint effusion present.' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('shows the row text with single spaces where an adult-only gap was dropped, and adds it without the empty blanks', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73090" laterality="LT" />);

    // Adult forearm: the growth-plate blank between "radius." and the closing line is dropped from the template.
    const fractureRow = screen.getByText(/fracture of the left/);
    expect(fractureRow.textContent).toBe(
      'Nondisplaced + fracture type fracture of the left distal radius. No dislocation. Alignment maintained.'
    );
    expect(screen.getByText('Alignment maintained.').textContent).toBe(
      'No acute fracture or dislocation. Alignment maintained. + incidental finding'
    );

    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);

    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Nondisplaced fracture of the left distal radius. No dislocation. Alignment maintained.'
    );
  });

  it('separates displacement from fracture type, so both can be stated', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73090" laterality="LT" />);
    // Rows: negative, fracture, both-bone fracture; the first displacement / type blanks are the fracture row's.
    await user.click(screen.getAllByRole('button', { name: 'Displacement: Nondisplaced' })[0]);
    await user.click(screen.getByRole('option', { name: 'Displaced' }));
    await user.click(screen.getAllByRole('button', { name: 'Fracture type: (none)' })[0]);
    const types = screen.getByRole('listbox', { name: 'Fracture type' });
    // Adult: no pediatric fracture types.
    expect(within(types).queryByRole('option', { name: 'buckle (torus)' })).not.toBeInTheDocument();
    await user.click(within(types).getByRole('option', { name: 'comminuted' }));
    await user.click(screen.getByRole('button', { name: 'Bone: distal radius' }));
    await user.click(screen.getByRole('option', { name: 'radial shaft' }));
    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);

    // "Alignment maintained" can't follow "Displaced"; the closing line takes the next option in its list.
    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Displaced comminuted fracture of the left radial shaft. Mild dorsal angulation.'
    );
  });

  it('leaves the pre-filled displacement empty once a fracture type is set', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73100" laterality="LT" />);

    await user.click(screen.getAllByRole('button', { name: 'Fracture type: (none)' })[0]);
    await user.click(screen.getByRole('option', { name: 'avulsion' }));
    expect(screen.getAllByRole('button', { name: 'Displacement: (none)' })[0]).toHaveTextContent('+ displacement');
    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);

    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Avulsion fracture of the left distal radius. No dislocation. Alignment maintained.'
    );
  });

  it('blocks a growth-plate line next to a Salter-Harris fracture the provider picked, and the other way round', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" isChild />);
    const notInvolved = /^Growth plate not involved\./;

    await user.click(screen.getByRole('button', { name: 'Fracture type: Salter-Harris I' }));
    await user.click(screen.getByRole('option', { name: 'Salter-Harris II' }));
    await user.click(screen.getByRole('button', { name: 'Growth plate (children only): (none)' }));
    const plate = screen.getByRole('listbox', { name: 'Growth plate (children only)' });
    expect(within(plate).getByRole('option', { name: notInvolved })).toHaveAttribute('aria-disabled', 'true');
    expect(within(plate).getByRole('option', { name: notInvolved })).toHaveTextContent('not with “Salter-Harris II”');
    await user.keyboard('{Escape}');

    // With a buckle fracture the pre-filled line comes back; once picked, Salter-Harris is the one that can't be.
    await user.click(screen.getByRole('button', { name: 'Fracture type: Salter-Harris II' }));
    await user.click(screen.getByRole('option', { name: 'buckle (torus)' }));
    await user.click(screen.getByRole('button', { name: 'Growth plate (children only): Growth plate not involved.' }));
    await user.click(screen.getByRole('option', { name: 'Growth plate not involved.' }));
    await user.click(screen.getByRole('button', { name: 'Fracture type: buckle (torus)' }));
    const types = screen.getByRole('listbox', { name: 'Fracture type' });
    expect(within(types).getByRole('option', { name: /^Salter-Harris I\b/ })).toHaveAttribute('aria-disabled', 'true');
    expect(within(types).getByRole('option', { name: 'greenstick' })).not.toHaveAttribute('aria-disabled');
  });

  it('lets a pick override a default it clashes with: the default steps aside instead of blocking the pick', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" isChild />);

    // Salter-Harris I is only the child ankle default, so "growth plate not involved" can be picked; the type
    // then steps back to (none) rather than the sentence contradicting itself.
    await user.click(screen.getByRole('button', { name: 'Growth plate (children only): (none)' }));
    await user.click(screen.getByRole('option', { name: 'Growth plate not involved.' }));
    expect(screen.getByRole('button', { name: 'Fracture type: (none)' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);

    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Nondisplaced fracture of the left distal fibula (lateral malleolus). Growth plate not involved. Ankle mortise intact.'
    );
  });

  it('moves the default "Alignment maintained" closing line to the next option when the fracture is picked as displaced', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73560" laterality="RT" />);

    expect(
      screen.getByRole('button', { name: 'Closing line: No dislocation. Alignment maintained.' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Displacement: Nondisplaced' }));
    await user.click(screen.getByRole('option', { name: 'Displaced' }));
    expect(screen.getByRole('button', { name: 'Closing line: No dislocation.' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);

    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Displaced fracture of the right patella. No dislocation.'
    );
  });

  it('starts fresh when the study, side or age changes, instead of carrying picks over to other templates', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness cptCode="73610" laterality="LT" />);

    await user.click(screen.getByRole('button', { name: 'Opening: No acute fracture or dislocation.' }));
    await user.click(screen.getByRole('option', { name: 'No acute osseous abnormality.' }));
    expect(screen.getByRole('button', { name: 'Opening: No acute osseous abnormality.' })).toBeInTheDocument();

    rerender(<Harness cptCode="73610" laterality="RT" />);
    expect(screen.getByRole('button', { name: 'Opening: No acute fracture or dislocation.' })).toBeInTheDocument();
    expect(screen.getByText(/fracture of the right/)).toBeInTheDocument();
  });

  it('does not offer a middle phalanx for the thumb', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73140" laterality="RT" />);

    await user.click(screen.getByRole('button', { name: 'Finger: 5th (small) finger' }));
    await user.click(screen.getByRole('option', { name: 'thumb' }));
    await user.click(screen.getByRole('button', { name: 'Phalanx: proximal phalanx' }));
    const phalanx = screen.getByRole('listbox', { name: 'Phalanx' });
    expect(within(phalanx).getByRole('option', { name: /^middle phalanx/ })).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(phalanx).getByRole('option', { name: 'distal phalanx (tuft)' }));
    await user.click(screen.getAllByRole('button', { name: ADD_BTN_LABEL })[1]);

    expect(screen.getByRole('textbox', { name: FIELD_LABEL })).toHaveValue(
      'Nondisplaced fracture of the distal phalanx (tuft) of the right thumb. No dislocation. Alignment maintained.'
    );
  });

  it('can be driven from the keyboard: Enter opens on the current value, arrows move, Enter picks, Escape returns', async () => {
    const user = userEvent.setup();
    render(<Harness cptCode="73610" laterality="LT" />);

    await user.tab();
    const blank = screen.getByRole('button', { name: 'Opening: No acute fracture or dislocation.' });
    expect(blank).toHaveFocus();
    expect(blank).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Enter}');
    expect(blank).toHaveAttribute('aria-expanded', 'true');
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
    expect(picked).toHaveAttribute('aria-expanded', 'false');
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
      // One side per sentence: a finding on both sides is the row added twice.
      expect(
        within(listbox)
          .getAllByRole('option')
          .map((o) => o.textContent)
      ).toEqual(['left', 'right']);
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
