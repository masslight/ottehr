import { fireEvent, render, screen, within } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { AutocompleteInput } from 'src/components/input/AutocompleteInput';
import { describe, expect, it } from 'vitest';

type Option = { id: string; name: string };

const OPTIONS: Option[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Alpine' },
];

let currentValue: Option[] = [];

function Harness({ initial = [] }: { initial?: Option[] }): React.JSX.Element {
  const methods = useForm<{ location: Option[] }>({ defaultValues: { location: initial } });
  currentValue = methods.watch('location');
  return (
    <FormProvider {...methods}>
      <AutocompleteInput<Option>
        name="location"
        label="Location"
        options={OPTIONS}
        getOptionLabel={(option) => option.name}
        getOptionKey={(option) => option.id}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        multiple
        withSelectAll
        limitTags={1}
      />
    </FormProvider>
  );
}

const openList = (): HTMLElement => {
  fireEvent.mouseDown(screen.getByRole('combobox'));
  return screen.getByRole('listbox');
};

const ids = (): string[] => currentValue.map((option) => option.id).sort();

describe('AutocompleteInput withSelectAll', () => {
  it('renders a checkbox per option with a Select all row first', () => {
    render(<Harness initial={[OPTIONS[1]]} />);
    const options = within(openList()).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Select all', 'Alpha', 'Beta', 'Alpine']);
    const checkboxes = options.map((option) => within(option).getByRole('checkbox') as HTMLInputElement);
    expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([false, false, true, false]);
    expect(checkboxes[0].dataset.indeterminate).toBe('true');
  });

  it('selects every option, then clears them, keeping the list open', () => {
    render(<Harness />);
    fireEvent.click(within(openList()).getByRole('option', { name: 'Select all' }));
    expect(ids()).toEqual(['1', '2', '3']);
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Select all' }));
    expect(ids()).toEqual([]);
  });

  const search = (text: string): HTMLElement => {
    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.change(input, { target: { value: text } });
    return screen.getByRole('listbox');
  };

  it('selects only options matching the search text', () => {
    render(<Harness />);
    const list = search('Alp');
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Select all', 'Alpha', 'Alpine']);
    fireEvent.click(within(list).getByRole('option', { name: 'Select all' }));
    expect(ids()).toEqual(['1', '3']);
  });

  it('clears only options matching the search text when they are all selected', () => {
    render(<Harness initial={OPTIONS} />);
    fireEvent.click(within(search('Alp')).getByRole('option', { name: 'Select all' }));
    expect(ids()).toEqual(['2']);
  });

  it('collapses chips beyond the limit into "+n" text while unfocused', () => {
    render(<Harness initial={OPTIONS} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
    expect(screen.getByText('+2')).toBeTruthy();
  });
});
