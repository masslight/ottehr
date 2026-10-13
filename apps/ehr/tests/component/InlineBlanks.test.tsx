import { Autocomplete, TextField } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  DateTimeBlank,
  MultiBlank,
  PopoverBlank,
  SelectBlank,
  Sentence,
  TextBlank,
} from '../../src/features/visits/in-person/components/procedures/narrative/InlineBlanks';

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
    expect(screen.getByTestId('site')).toHaveFocus();
    expect(screen.getByTestId('site')).toHaveAttribute('aria-expanded', 'false');
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
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates choices with arrows, Home and End, then returns focus after a keyboard pick', async () => {
    const user = userEvent.setup();
    render(<Select />);
    const trigger = screen.getByTestId('site');
    await user.click(trigger);
    const hand = screen.getByRole('option', { name: 'Hand' });
    const foot = screen.getByRole('option', { name: 'Foot' });
    hand.focus();
    await user.keyboard('{ArrowDown}');
    expect(foot).toHaveFocus();
    await user.keyboard('{Home}');
    expect(hand).toHaveFocus();
    await user.keyboard('{End}{Enter}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent('foot');
  });

  it('recognizes its own portal clicks while letting an outside CPT option close it and select', async () => {
    const user = userEvent.setup();
    const insidePick = vi.fn();
    const outsidePick = vi.fn();
    render(
      <>
        <PopoverBlank label="procedure" readOnly={false}>
          {() => (
            <Autocomplete
              options={['Inside procedure']}
              onChange={insidePick}
              openOnFocus
              renderInput={(params) => <TextField {...params} label="Procedure choice" />}
            />
          )}
        </PopoverBlank>
        <Autocomplete
          open
          options={['12042']}
          onChange={outsidePick}
          renderInput={(params) => <TextField {...params} label="CPT" />}
        />
      </>
    );
    await user.click(screen.getByRole('button', { name: 'procedure (empty)' }));
    await user.type(screen.getByRole('combobox', { name: 'Procedure choice' }), 'Inside');
    await user.click(await screen.findByRole('option', { name: 'Inside procedure' }));
    expect(insidePick).toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'procedure' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: '12042' }));
    expect(outsidePick).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'procedure' })).not.toBeInTheDocument();
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

  it('edits custom single and multiple answers inside their blanks and keeps the other selections', async () => {
    const user = userEvent.setup();
    function OtherFields(): ReactElement {
      const [single, setSingle] = useState<string | undefined>();
      const [singleText, setSingleText] = useState('');
      const [multiple, setMultiple] = useState<string[]>(['Gauze']);
      const [multipleText, setMultipleText] = useState('');
      return (
        <>
          <SelectBlank
            label="site"
            options={['Hand', 'Other']}
            value={single}
            onChange={setSingle}
            otherValue={singleText}
            onOtherChange={setSingleText}
            readOnly={false}
            dataTestId="other-site"
          />
          <MultiBlank
            label="supplies"
            options={['Gauze', 'Other']}
            values={multiple}
            onChange={setMultiple}
            otherValue={multipleText}
            onOtherChange={setMultipleText}
            readOnly={false}
            dataTestId="other-supplies"
          />
        </>
      );
    }
    render(<OtherFields />);
    await user.click(screen.getByTestId('other-site'));
    await user.click(screen.getByRole('option', { name: 'Other' }));
    await user.type(screen.getByRole('textbox', { name: 'Other site' }), 'Left elbow');
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('other-site')).toHaveTextContent('Left elbow');
    await user.click(screen.getByTestId('other-supplies'));
    await user.click(screen.getByRole('checkbox', { name: 'Other' }));
    await user.type(screen.getByRole('textbox', { name: 'Other supplies' }), 'Custom dressing');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('other-supplies')).toHaveTextContent('gauze and Custom dressing');
  });

  it('uses field names rather than add labels for empty read-only values', () => {
    render(<MultiBlank label="technique" options={[]} values={[]} onChange={vi.fn()} readOnly />);
    expect(screen.getByText('[technique]')).toBeInTheDocument();
    expect(screen.queryByText('[+ technique]')).not.toBeInTheDocument();
  });
  it('keeps the Escape handler stable while filtering and restores focus on Escape', async () => {
    const user = userEvent.setup();
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    render(
      <SelectBlank
        label="long choice"
        options={['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota']}
        value={undefined}
        onChange={vi.fn()}
        readOnly={false}
      />
    );
    await user.click(screen.getByRole('button', { name: 'long choice (empty)' }));
    const additions = (): number =>
      add.mock.calls.filter(
        ([type, listener, options]) =>
          type === 'keydown' && options === true && typeof listener === 'function' && listener.name === 'onKeyDown'
      ).length;
    const before = additions();
    await user.type(screen.getByRole('textbox', { name: 'Filter long choice' }), 'abc');
    expect(additions()).toBe(before);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'long choice (empty)' })).toHaveFocus();
    expect(
      remove.mock.calls.filter(
        ([type, listener, options]) =>
          type === 'keydown' && options === true && typeof listener === 'function' && listener.name === 'onKeyDown'
      )
    ).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
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
    expect(input).toHaveAttribute('placeholder', 'length (cm)');
    expect(input).not.toHaveAttribute('title');
    expect(input).toHaveStyle({ textAlign: 'center', borderStyle: 'dashed' });
    await user.type(input, '3.5');
    expect(onChange).toHaveBeenLastCalledWith('3.5');
    expect(input).not.toHaveStyle({ borderStyle: 'dashed' });
  });
});

describe('date and time blanks', () => {
  const saved = DateTime.fromISO('2026-10-14T14:05:00Z', { setZone: true }).setLocale('en-US');

  it.each([
    { kind: 'date' as const, expected: 'Oct 14, 2026' },
    { kind: 'time' as const, expected: '2:05 PM' },
  ])('shows a saved $kind as plain text when read-only', ({ kind, expected }) => {
    render(<DateTimeBlank kind={kind} label={kind} value={saved} onChange={vi.fn()} readOnly />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each(['date', 'time'] as const)('shows a placeholder for an empty or invalid %s', (kind) => {
    const { rerender } = render(<DateTimeBlank kind={kind} label={kind} value={null} onChange={vi.fn()} readOnly />);
    expect(screen.getByText(`[${kind}]`)).toBeInTheDocument();
    rerender(
      <DateTimeBlank kind={kind} label={kind} value={DateTime.invalid('Invalid')} onChange={vi.fn()} readOnly />
    );
    expect(screen.getByText(`[${kind}]`)).toBeInTheDocument();
  });

  it.each([
    { kind: 'date' as const, raw: '10/20/2026', expected: '2026-10-20', format: 'yyyy-MM-dd' },
    { kind: 'time' as const, raw: '03:10 PM', expected: '15:10', format: 'HH:mm' },
  ])('edits a $kind using the real picker and preserves its timezone', ({ kind, raw, expected, format }) => {
    const onChange = vi.fn();
    function PickerForm(): ReactElement {
      const [value, setValue] = useState<DateTime | null>(saved);
      return (
        <DateTimeBlank
          kind={kind}
          label={`procedure ${kind}`}
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          readOnly={false}
        />
      );
    }
    render(<PickerForm />);
    fireEvent.change(screen.getByLabelText(`procedure ${kind}`), { target: { value: raw } });
    const next: DateTime = onChange.mock.calls.at(-1)?.[0];
    expect(next?.isValid).toBe(true);
    expect(next?.toFormat(format)).toBe(expected);
    expect(next?.zoneName).toBe(saved.zoneName);
  });
});
