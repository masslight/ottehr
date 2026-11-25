import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateInput } from '../../src/components/DateInput';

describe('DateInput', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['Date'],
    });
    // 02:30 UTC on the 6th is still the 5th in New York
    vi.setSystemTime(new Date('2026-03-06T02:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['a date', '2026-03-01'],
    ['no date', ''],
  ])("sets Today to the given timezone's day when the field holds %s", async (_, value) => {
    const onChange = vi.fn();
    render(<DateInput label="Payment date" value={value} onChange={onChange} timezone="America/New_York" />);

    const openCalendar = screen.getByRole('button', { name: /choose date/i });
    await userEvent.click(openCalendar);
    const today = await screen.findByTestId('date-range-today-button');
    await userEvent.click(today);

    expect(onChange).toHaveBeenCalledWith('2026-03-05');
  });
});
