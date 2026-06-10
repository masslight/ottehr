import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleCapacity } from '../../src/components/schedule/ScheduleCapacity';
import { Day } from '../../src/types/types';

const emptyDay = (open: number, close: number): Day => ({
  open,
  close,
  openingBuffer: 0,
  closingBuffer: 0,
  hours: [],
});

describe('ScheduleCapacity windowing', () => {
  it('honours openingHour=0 (midnight) instead of falling back to day.open', () => {
    // 24/7 window: open at midnight, close at noon. The prop `openingHour=0`
    // is the canonical source; falling back to day.open would render the
    // wrong hour range.
    const day = emptyDay(8, 17);

    render(
      <ScheduleCapacity
        day={day}
        setDay={() => {}}
        openingHour={0}
        closingHour={12}
        openingBuffer={0}
        closingBuffer={0}
        ownerType="Location"
      />
    );

    // Hour 0 ("12 AM") must be present; hour 8 (day.open) must NOT be the
    // first row.
    expect(screen.getByText(/12 AM/i)).toBeInTheDocument();
  });
});

describe('ScheduleCapacity Location decimal handling', () => {
  it('keeps prebookSlots and capacity consistent when the user types a decimal', async () => {
    // Locations are integer-only at the data layer; the input step is 1.
    // But manual typing can produce decimals — the resulting Day update must
    // not leave prebookSlots and capacity out of sync.
    const day: Day = {
      open: 0,
      close: 24,
      openingBuffer: 0,
      closingBuffer: 0,
      hours: [{ hour: 0, capacity: 1, prebookSlots: 1 }],
    };
    const setDay = vi.fn();
    const user = userEvent.setup();

    render(
      <ScheduleCapacity
        day={day}
        setDay={setDay}
        openingHour={0}
        closingHour={1}
        openingBuffer={0}
        closingBuffer={0}
        ownerType="Location"
      />
    );

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '1.5');

    // The last setDay call carries the final value the user typed.
    expect(setDay).toHaveBeenCalled();
    const lastCall = setDay.mock.calls[setDay.mock.calls.length - 1][0] as Day;
    const hourEntry = lastCall.hours.find((h) => h.hour === 0);
    if (!hourEntry) throw new Error('expected an entry for hour 0');
    expect(hourEntry.prebookSlots).toBe(hourEntry.capacity);
  });
});
