import { fireEvent, render, screen } from '@testing-library/react';
import { GetChartDataResponse, LBS_IN_KG, VitalsObservationDTO } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { NoteSections } from '../../src/features/easy-charting/NoteSections';
import { VitalAddChips } from '../../src/features/easy-charting/VitalAddChips';

// "Option C — add-chips, progressive disclosure": un-charted standard vitals render as ghost
// "+ <Label>" chips; clicking one swaps in the same dual-unit inline editor VitalRow uses, Enter
// (or click-away) with a valid value saves the canonical DTO, Escape/empty reverts to the chip.
describe('VitalAddChips', () => {
  const heartbeat = { field: 'vital-heartbeat', value: 70 } as VitalsObservationDTO;

  it('renders chips only for the standard vitals that are not yet charted', () => {
    render(<VitalAddChips vitals={[heartbeat]} onSaveVital={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '+ HR' })).toBeNull();
    for (const label of ['+ Temp', '+ RR', '+ BP', '+ O₂ sat', '+ Weight', '+ Height']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
    // Vision and LMP are charted-only — never offered as chips.
    expect(screen.queryByRole('button', { name: '+ Vision' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ LMP' })).toBeNull();
  });

  it('clicking a chip swaps in the dual-unit editor with the first input focused', () => {
    render(<VitalAddChips vitals={[]} onSaveVital={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Weight' }));
    expect(screen.queryByRole('button', { name: '+ Weight' })).toBeNull();
    const inputs = screen.getAllByRole('spinbutton');
    // kg + lbs boxes for weight (the other chips are still just chips, no inputs).
    expect(inputs).toHaveLength(2);
    expect(document.activeElement).toBe(inputs[0]);
    expect(screen.getByText('kg')).toBeDefined();
    expect(screen.getByText('lbs')).toBeDefined();
  });

  it('saves weight entered in lbs as the canonical kg value on Enter, and keeps the chip hidden while in flight', () => {
    const onSaveVital = vi.fn();
    render(<VitalAddChips vitals={[]} onSaveVital={onSaveVital} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Weight' }));
    const [kgInput, lbsInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(lbsInput, { target: { value: '22' } });
    // Sibling unit box cross-fills from the canonical value.
    expect((kgInput as HTMLInputElement).value).not.toBe('');
    fireEvent.keyDown(lbsInput, { key: 'Enter' });
    expect(onSaveVital).toHaveBeenCalledTimes(1);
    const dto = onSaveVital.mock.calls[0][0];
    expect(dto.field).toBe('vital-weight');
    expect(dto.value).toBeCloseTo(22 / LBS_IN_KG, 5);
    // Optimistic in-flight guard: the chip must not flicker back before the data refresh lands.
    expect(screen.queryByRole('button', { name: '+ Weight' })).toBeNull();
  });

  it('saves blood pressure as systolic/diastolic on Enter', () => {
    const onSaveVital = vi.fn();
    render(<VitalAddChips vitals={[]} onSaveVital={onSaveVital} />);
    fireEvent.click(screen.getByRole('button', { name: '+ BP' }));
    const [sysInput, diaInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(sysInput, { target: { value: '120' } });
    fireEvent.change(diaInput, { target: { value: '80' } });
    fireEvent.keyDown(diaInput, { key: 'Enter' });
    expect(onSaveVital).toHaveBeenCalledTimes(1);
    expect(onSaveVital.mock.calls[0][0]).toMatchObject({
      field: 'vital-blood-pressure',
      systolicPressure: 120,
      diastolicPressure: 80,
    });
  });

  it('Escape reverts to the chip without saving', () => {
    const onSaveVital = vi.fn();
    render(<VitalAddChips vitals={[]} onSaveVital={onSaveVital} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Temp' }));
    const [input] = screen.getAllByRole('spinbutton');
    fireEvent.change(input, { target: { value: '98.6' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSaveVital).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '+ Temp' })).toBeDefined();
  });

  it('Enter with nothing entered reverts to the chip without saving', () => {
    const onSaveVital = vi.fn();
    render(<VitalAddChips vitals={[]} onSaveVital={onSaveVital} />);
    fireEvent.click(screen.getByRole('button', { name: '+ HR' }));
    const [input] = screen.getAllByRole('spinbutton');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSaveVital).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '+ HR' })).toBeDefined();
  });
});

describe('NoteSections vitals section gating', () => {
  const emptyData = { patientId: 'p1' } as GetChartDataResponse;
  const baseProps = { data: emptyData, freshlyAdded: new Set<string>(), removingItems: new Set<string>() };

  it('renders the Vitals section with add chips when editable, even with no vitals charted', () => {
    render(<NoteSections {...baseProps} editable onSaveVital={vi.fn()} />);
    expect(screen.getByText('Vitals')).toBeDefined();
    expect(screen.getByRole('button', { name: '+ Temp' })).toBeDefined();
  });

  it('keeps the read-only behavior: no Vitals section when nothing is charted', () => {
    render(<NoteSections {...baseProps} />);
    expect(screen.queryByText('Vitals')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Temp' })).toBeNull();
  });
});
