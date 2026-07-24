import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { dateRangeDayTestId, DateRangeInput } from '../../src/components/DateRangeInput';

const FIELD_TEST_ID = 'date-filter';

const Harness = ({ from, to }: { from: string; to: string }): ReactElement => {
  const [range, setRange] = useState({
    from,
    to,
  });
  return (
    <>
      <DateRangeInput
        label="Date"
        valueFrom={range.from}
        valueTo={range.to}
        onChange={(f, t) =>
          setRange({
            from: f,
            to: t,
          })
        }
        dataTestId={FIELD_TEST_ID}
      />
      <div data-testid="values">{`${range.from}|${range.to}`}</div>
    </>
  );
};

const getValues = (): string => screen.getByTestId('values').textContent ?? '';

const openPicker = async (): Promise<void> => {
  await userEvent.click(screen.getByTestId(FIELD_TEST_ID));
};

const clickDay = async (isoDate: string): Promise<void> => {
  await userEvent.click(screen.getByTestId(dateRangeDayTestId(isoDate)));
};

describe('DateRangeInput', () => {
  it('displays a single date and commits both boundaries on one day click', async () => {
    render(<Harness from="2026-07-10" to="2026-07-10" />);

    expect(screen.getByTestId(FIELD_TEST_ID)).toHaveValue('07/10/2026');

    await openPicker();
    await clickDay('2026-07-15');

    expect(getValues()).toBe('2026-07-15|2026-07-15');
  });

  it('commits only a complete range in Date Range mode', async () => {
    render(<Harness from="2026-07-10" to="2026-07-10" />);

    await openPicker();
    await userEvent.click(screen.getByTestId('date-range-mode-checkbox'));
    await clickDay('2026-07-13');
    // nothing happens until 2 dates are selected
    expect(getValues()).toBe('2026-07-10|2026-07-10');
    await clickDay('2026-07-17');

    expect(getValues()).toBe('2026-07-13|2026-07-17');
  });

  it('displays a range when the boundaries differ', () => {
    render(<Harness from="2026-07-10" to="2026-07-14" />);

    expect(screen.getByTestId(FIELD_TEST_ID)).toHaveValue('07/10/2026 – 07/14/2026');
  });

  it('sets both boundaries to today via the Today button', async () => {
    render(<Harness from="2026-07-10" to="2026-07-10" />);

    await openPicker();
    await userEvent.click(screen.getByTestId('date-range-today-button'));

    const today = DateTime.now().toISODate();
    expect(getValues()).toBe(`${today}|${today}`);
  });
});
