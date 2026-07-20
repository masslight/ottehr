import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { DateRangeInput } from '../../src/components/input/DateRangeInput';
import { dataTestIds } from '../../src/constants/data-test-ids';

const FIELD_TEST_ID = 'date-filter';

// Surfaces the current form values so assertions can inspect what the picker committed.
const ValuesProbe = (): ReactElement => {
  const [dateFrom, dateTo] = useWatch({ name: ['dateFrom', 'dateTo'] });
  return <div data-testid="values">{`${dateFrom ?? ''}|${dateTo ?? ''}`}</div>;
};

const Harness = ({ dateFrom, dateTo }: { dateFrom: string | null; dateTo: string | null }): ReactElement => {
  const methods = useForm({ defaultValues: { dateFrom, dateTo }, mode: 'onChange' });
  return (
    <FormProvider {...methods}>
      <DateRangeInput
        dateFromName="dateFrom"
        dateToName="dateTo"
        label="Date"
        dataTestId={FIELD_TEST_ID}
        maxRangeDays={45}
      />
      <ValuesProbe />
    </FormProvider>
  );
};

const getValues = (): string => screen.getByTestId('values').textContent ?? '';

const openPicker = async (): Promise<void> => {
  await userEvent.click(screen.getByTestId(FIELD_TEST_ID));
};

const clickDay = async (isoDate: string): Promise<void> => {
  await userEvent.click(screen.getByTestId(dataTestIds.dashboard.datePickerDay(isoDate)));
};

describe('DateRangeInput', () => {
  it('displays a single date when both boundaries are the same day and commits both on one day click', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-10" />);

    expect(screen.getByTestId(FIELD_TEST_ID)).toHaveValue('07/10/2026');

    await openPicker();
    await clickDay('2026-07-15');

    expect(getValues()).toBe('2026-07-15|2026-07-15');
  });

  it('selects a start and end date with the Date Range checkbox checked', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-10" />);

    await openPicker();
    await userEvent.click(screen.getByTestId(dataTestIds.dashboard.dateRangeModeCheckbox));
    await clickDay('2026-07-13');
    // The first click only stages the start date; nothing is committed until the range is complete.
    expect(getValues()).toBe('2026-07-10|2026-07-10');
    await clickDay('2026-07-17');

    expect(getValues()).toBe('2026-07-13|2026-07-17');
  });

  it('collapses a multi-day range to its start date when the checkbox is unchecked', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-14" />);

    expect(screen.getByTestId(FIELD_TEST_ID)).toHaveValue('07/10/2026 – 07/14/2026');

    await openPicker();
    const checkbox = screen.getByTestId(dataTestIds.dashboard.dateRangeModeCheckbox);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);

    expect(getValues()).toBe('2026-07-10|2026-07-10');
  });

  it('sets both boundaries to today via the Today button', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-10" />);

    await openPicker();
    await userEvent.click(screen.getByTestId(dataTestIds.dashboard.datePickerTodayButton));

    const today = DateTime.now().toISODate();
    expect(getValues()).toBe(`${today}|${today}`);
  });

  it('shows an inline error for an out-of-order range seeded from outside the picker', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-01" />);

    await waitFor(() => {
      expect(screen.getByText('Start date must be on or before end date.')).toBeVisible();
    });
  });
});
