import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime, Settings } from 'luxon';
import { ReactElement, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DateTimeInput } from '../../src/components/DateInput';

const FIELD_TEST_ID = 'admission-date';

const Harness = ({ initial }: { initial: string }): ReactElement => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateTimeInput label="Admission Date" value={value} onChange={setValue} dataTestId={FIELD_TEST_ID} />
      <div data-testid="committed-value">{value}</div>
    </>
  );
};

const getInput = (): HTMLInputElement => screen.getByTestId(FIELD_TEST_ID).querySelector('input') as HTMLInputElement;
const getCommittedValue = (): string => screen.getByTestId('committed-value').textContent ?? '';

describe('DateTimeInput', () => {
  afterEach(() => {
    Settings.defaultZone = 'system';
  });

  it('commits the entered date and time without a UTC offset', async () => {
    render(<Harness initial="" />);

    const input = getInput();
    await userEvent.click(input);
    // MUI's sectioned field auto-advances MM -> dd -> yyyy -> HH -> mm as each section fills up,
    // so no separators need to be typed.
    await userEvent.type(input, '011520261030');

    const committed = getCommittedValue();
    expect(committed).toBe('2026-01-15T10:30');
    // No trailing "Z" or "+HH:mm"/"-HH:mm" offset should be persisted.
    expect(committed).not.toMatch(/Z$|[+-]\d{2}:\d{2}$/);
  });

  it('displays the same wall-clock value regardless of the viewer timezone', () => {
    const storedValue = '2026-01-15T10:30';

    Settings.defaultZone = 'America/New_York';
    const { unmount } = render(<Harness initial={storedValue} />);
    expect(getInput()).toHaveValue('01/15/2026 10:30');
    unmount();

    Settings.defaultZone = 'Asia/Tokyo';
    render(<Harness initial={storedValue} />);
    expect(getInput()).toHaveValue('01/15/2026 10:30');
  });

  it('reproduces the historical bug when an offset is embedded in the stored value', () => {
    // Guards against regressing back to offset-bearing persistence: a value saved with an
    // embedded offset (the old, buggy behavior) DOES shift when read in a different timezone,
    // which is exactly the mismatch this fix eliminates going forward.
    const storedValueWithOffset = DateTime.fromISO('2026-01-15T10:30:00', { zone: 'America/New_York' }).toISO();

    Settings.defaultZone = 'America/New_York';
    const { unmount } = render(<Harness initial={storedValueWithOffset ?? ''} />);
    expect(getInput()).toHaveValue('01/15/2026 10:30');
    unmount();

    Settings.defaultZone = 'Asia/Tokyo';
    render(<Harness initial={storedValueWithOffset ?? ''} />);
    expect(getInput()).not.toHaveValue('01/15/2026 10:30');
  });
});
