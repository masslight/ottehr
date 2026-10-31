import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { describe, expect, it, vi } from 'vitest';
import { MedicationCardField } from '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/MedicationCardField';

const inDays = (days: number): string => DateTime.now().plus({ days }).toISODate();

const lot = (
  id: string,
  lotNumber: string,
  expirationDate: string,
  onHand: number,
  manufacturer: string
): InventoryLot => ({
  id,
  catalogMedicationId: 'med-1',
  locationId: 'loc-a',
  lotNumber,
  expirationDate,
  ndc: `ndc-${lotNumber}`,
  manufacturer,
  onHand,
  unit: 'vial',
  status: 'active',
});

// Deliberately out of order: the field sorts soonest expiration first and expired last.
const LOTS: InventoryLot[] = [
  lot('lot-2', 'HK3302', inDays(240), 18, 'Hikma'),
  lot('lot-3', 'B88120', inDays(-30), 2, 'Civica'),
  lot('lot-1', 'C24117', inDays(16), 1, 'Civica'),
];

const selectsOptions = new Proxy({} as any, { get: () => ({ options: [], status: 'loaded' }) });

function Harness({
  initial = '',
  onPick,
  lots = LOTS,
}: {
  initial?: string;
  onPick: (picked: InventoryLot) => void;
  lots?: InventoryLot[];
}): React.JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <MedicationCardField
      field="lotNumber"
      label="Lot Number"
      value={value}
      required
      onChange={(_field, newValue) => setValue(String(newValue ?? ''))}
      selectsOptions={selectsOptions}
      inventoryLots={lots.length ? { lots, locationName: 'Main Street Clinic' } : undefined}
      onInventoryLotPick={(picked) => {
        setValue(picked.lotNumber);
        onPick(picked);
      }}
    />
  );
}

const openList = (): HTMLElement => {
  fireEvent.mouseDown(screen.getByRole('combobox'));
  return screen.getByRole('listbox');
};

describe('MedicationCardField lot suggestions', () => {
  it('lists the lots on hand at the location, soonest expiration first, expired last and marked', () => {
    render(<Harness onPick={vi.fn()} />);
    const list = openList();

    expect(within(list).getByText('On hand at Main Street Clinic')).toBeInTheDocument();
    const options = within(list).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      `C24117 · exp ${DateTime.fromISO(inDays(16)).toFormat('MM/dd/yyyy')}1 vial · Civica`,
      `HK3302 · exp ${DateTime.fromISO(inDays(240)).toFormat('MM/dd/yyyy')}18 vials · Hikma`,
      `B88120 · exp ${DateTime.fromISO(inDays(-30)).toFormat('MM/dd/yyyy')}expired2 vials · Civica`,
    ]);
    expect(within(options[2]).getByText('expired')).toBeInTheDocument();
    expect(within(options[0]).queryByText('expired')).not.toBeInTheDocument();
    expect(screen.getByText(/Or type a lot that isn't listed/)).toBeInTheDocument();
  });

  it('picking a lot reports the lot so expiration, NDC and manufacturer can be filled', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    fireEvent.click(within(openList()).getByRole('option', { name: /HK3302/ }));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ lotNumber: 'HK3302', ndc: 'ndc-HK3302' }));
    expect(screen.getByRole('combobox')).toHaveValue('HK3302');
  });

  it('typing a listed lot number counts as a pick; other text is kept as typed', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<Harness onPick={onPick} />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'SAMPLE');
    expect(onPick).not.toHaveBeenCalled();
    expect(input).toHaveValue('SAMPLE');

    await user.clear(input);
    await user.type(input, 'B88120');
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ lotNumber: 'B88120' }));
    expect(input).toHaveValue('B88120');
  });

  it('keeps the whole list visible while the field holds a listed lot', () => {
    render(<Harness initial="C24117" onPick={vi.fn()} />);
    expect(within(openList()).getAllByRole('option')).toHaveLength(3);
  });

  it('is a plain text field when the drug has no lots on hand', () => {
    render(<Harness onPick={vi.fn()} lots={[]} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
