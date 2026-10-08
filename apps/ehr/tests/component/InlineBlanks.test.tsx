import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  MultiBlank,
  SelectBlank,
  Sentence,
  TextBlank,
} from '../../src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { sentenceValue } from '../../src/features/visits/in-person/components/procedures/narrative/sentenceValue';

function Select({ readOnly = false, initial }: { readOnly?: boolean; initial?: string }): ReactElement {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <SelectBlank
      label="site/location"
      title="Site/location"
      options={['Hand', 'Foot']}
      value={value}
      onChange={setValue}
      readOnly={readOnly}
      need
      clearable
      dataTestId="site"
    />
  );
}

describe('sentence value', () => {
  it.each([
    ['Tolerated Well', 'tolerated well'],
    ['Left elbow', 'left elbow'],
    ['Return if worsening', 'return if worsening'],
    ['second-degree AV block, Mobitz I', 'second-degree AV block, Mobitz I'],
    ['IV Kit', 'IV kit'],
    ['McBurney point', 'McBurney point'],
  ])('reads %s as "%s" inside a sentence', (stored, shown) => {
    expect(sentenceValue(stored)).toBe(shown);
  });
});

describe('inline blanks', () => {
  it('opens a list on click, picks a value, and clears it again', async () => {
    const user = userEvent.setup();
    render(<Select />);
    const blank = screen.getByTestId('site');
    expect(blank).toHaveTextContent('site/location');
    expect(blank).toHaveAccessibleName('site/location (empty)');

    await user.click(blank);
    await user.click(screen.getByRole('option', { name: 'Hand' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // Stored "Hand" reads as prose in the sentence; the popover list keeps the stored text.
    expect(screen.getByTestId('site')).toHaveTextContent('hand');

    await user.click(screen.getByTestId('site'));
    await user.click(screen.getByRole('option', { name: 'Clear' }));
    expect(screen.getByTestId('site')).toHaveTextContent('site/location');
  });

  it('keeps a saved value that is not in the option list, and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Select initial="Left elbow" />);
    await user.click(screen.getByTestId('site'));
    expect(screen.getByRole('option', { name: 'Left elbow' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('site')).toHaveTextContent('left elbow');
  });

  it('lets one outside click both close the popover and reach its target', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <>
        <Select />
        <button onClick={onSave}>Save</button>
      </>
    );
    await user.click(screen.getByTestId('site'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders plain text when read-only', () => {
    render(<Select readOnly initial="Hand" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('hand')).toBeInTheDocument();
  });

  it('filters long lists and picks the first match on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectBlank
        label="procedure"
        options={['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota']}
        value={undefined}
        onChange={onChange}
        readOnly={false}
        dataTestId="long"
      />
    );
    await user.click(screen.getByTestId('long'));
    await user.type(screen.getByRole('textbox', { name: 'Filter procedure' }), 'the{Enter}');
    expect(onChange).toHaveBeenCalledWith('Theta');
  });

  it('toggles multi-select values with checkboxes and reads them back as a list', async () => {
    const user = userEvent.setup();
    function Multi(): ReactElement {
      const [values, setValues] = useState<string[]>(['Curette']);
      return (
        <MultiBlank
          label="technique"
          options={['Curette', 'Sterile', 'Clean']}
          values={values}
          onChange={setValues}
          readOnly={false}
          dataTestId="technique"
        />
      );
    }
    render(<Multi />);
    await user.click(screen.getByTestId('technique'));
    await user.click(screen.getByRole('checkbox', { name: 'Sterile' }));
    await user.click(screen.getByRole('checkbox', { name: 'Curette' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('technique')).toHaveTextContent('sterile');
    expect(screen.getByTestId('technique')).not.toHaveTextContent(/curette/i);
  });

  it('keeps punctuation joined to its blank without making the value unbreakable', () => {
    render(
      <Sentence>
        of the <Select initial="Hand" /> (<Select initial="Foot" />
        ), closed with <TextBlank label="count" kind="number" value={4} onChange={vi.fn()} readOnly={false} />.
      </Sentence>
    );
    const [hand, foot] = screen.getAllByTestId('site');
    // An input is an atomic inline, so it and its full stop share a no-break wrapper instead.
    const count = screen.getByRole('spinbutton', { name: 'count' });
    expect(count.closest('span[class*="MuiBox"]')).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(count.closest('span[class*="MuiBox"]')?.textContent).toBe('\u2060.');
    // Word joiners sit between a blank and its bracket / comma; the wrapper itself may wrap like text.
    expect(hand.parentElement?.textContent).toBe('hand');
    expect(foot.parentElement?.textContent).toBe('(\u2060foot\u2060),');
    expect(hand.parentElement).not.toHaveStyle({ whiteSpace: 'nowrap' });
    expect(hand.tagName).toBe('SPAN');
  });

  it('renders numeric children as text', () => {
    render(
      <Sentence>
        Wound {1}: <Select initial="Hand" />
      </Sentence>
    );
    expect(screen.getByText(/Wound 1:/)).toBeInTheDocument();
  });

  it('accepts inline number input and passes the raw text up', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Length(): ReactElement {
      const [value, setValue] = useState<string>('');
      return (
        <TextBlank
          label="length (cm)"
          kind="number"
          value={value}
          onChange={(raw) => {
            setValue(raw);
            onChange(raw);
          }}
          readOnly={false}
        />
      );
    }
    render(<Length />);
    const input = screen.getByRole('spinbutton', { name: 'length (cm)' });
    // Number boxes share the text-input look: centred, dashed while empty, and the label as tooltip.
    expect(input).toHaveAttribute('placeholder', 'cm');
    expect(input).toHaveAttribute('title', 'length (cm)');
    expect(input).toHaveStyle({ textAlign: 'center', borderStyle: 'dashed' });
    await user.type(input, '3.5');
    expect(onChange).toHaveBeenLastCalledWith('3.5');
    expect(input).not.toHaveStyle({ borderStyle: 'dashed' });
  });
});
