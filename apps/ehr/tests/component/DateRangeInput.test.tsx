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

const getDay = (isoDate: string): HTMLElement => screen.getByTestId(dataTestIds.dashboard.datePickerDay(isoDate));

const clickDay = async (isoDate: string): Promise<void> => {
  await userEvent.click(getDay(isoDate));
};

const enableRangeMode = async (): Promise<void> => {
  await userEvent.click(screen.getByTestId(dataTestIds.dashboard.dateRangeModeCheckbox));
};
const openMonthList = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: /switch to/ }));
};

const clickMonth = async (name: string): Promise<void> => {
  await userEvent.click(screen.getByRole('radio', { name }));
};

const goToNextMonth = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
};

const getMonthLabel = (): string => screen.getByText(/^[A-Z][a-z]+ \d{4}$/).textContent ?? '';
const bandOf = (isoDate: string): string | undefined => getDay(isoDate).parentElement?.dataset.band;

// Disabled days do not take pointer events, so the cell around them is what gets hovered.
const hoverCell = async (isoDate: string): Promise<void> => {
  await userEvent.hover(getDay(isoDate).parentElement as HTMLElement);
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
    await enableRangeMode();
    await clickDay('2026-07-13');
    // The first click only stages the start date: nothing is committed until the range is complete,
    // and the staged start is a selected day rather than a one-day band.
    expect(getValues()).toBe('2026-07-10|2026-07-10');
    expect(getDay('2026-07-13')).toHaveAttribute('aria-selected', 'true');
    expect(bandOf('2026-07-13')).toBeUndefined();
    await clickDay('2026-07-17');

    expect(getValues()).toBe('2026-07-13|2026-07-17');
  });

  it('previews the range that hovering would complete', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-10" />);

    await openPicker();
    await enableRangeMode();
    await clickDay('2026-07-13');
    await userEvent.hover(getDay('2026-07-16'));

    expect(['2026-07-13', '2026-07-15', '2026-07-16'].map(bandOf)).toEqual(['preview', 'preview', 'preview']);
    expect(bandOf('2026-07-17')).toBeUndefined();
    // The preview follows the cursor and commits nothing.
    await userEvent.unhover(getDay('2026-07-16'));
    expect(bandOf('2026-07-15')).toBeUndefined();
    expect(getValues()).toBe('2026-07-10|2026-07-10');
  });

  it('does not reuse an old hover preview after Date Range mode is toggled with the keyboard', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-10" />);

    await openPicker();
    await enableRangeMode();
    await clickDay('2026-07-13');
    await userEvent.hover(getDay('2026-07-16'));
    expect(bandOf('2026-07-15')).toBe('preview');

    const checkbox = screen.getByTestId(dataTestIds.dashboard.dateRangeModeCheckbox);
    checkbox.focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard(' ');

    getDay('2026-07-14').focus();
    await userEvent.keyboard('{Enter}');

    expect(getDay('2026-07-14')).toHaveAttribute('aria-selected', 'true');
    expect(bandOf('2026-07-15')).toBeUndefined();
    expect(getValues()).toBe('2026-07-10|2026-07-10');
  });

  it('starts a fresh range when the second click lands before the staged start date', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-10" />);

    await openPicker();
    await enableRangeMode();
    await clickDay('2026-07-17');
    await clickDay('2026-07-13');
    expect(getValues()).toBe('2026-07-10|2026-07-10');
    await clickDay('2026-07-15');

    expect(getValues()).toBe('2026-07-13|2026-07-15');
  });

  it('picks a month from the header and completes a range in it', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-10" />);

    await openPicker();
    await enableRangeMode();
    await openMonthList();
    await clickMonth('October');

    // Choosing a month navigates back to the days without selecting anything.
    expect(getMonthLabel()).toBe('October 2026');
    expect(getValues()).toBe('2026-07-10|2026-07-10');

    await clickDay('2026-10-05');
    await clickDay('2026-10-09');

    expect(getValues()).toBe('2026-10-05|2026-10-09');
  });

  it('keeps the year reached with the month arrows when a month is then picked', async () => {
    render(<Harness dateFrom="2026-12-10" dateTo="2026-12-10" />);

    await openPicker();
    await goToNextMonth();
    expect(getMonthLabel()).toBe('January 2027');

    await openMonthList();
    await clickMonth('March');

    expect(getMonthLabel()).toBe('March 2027');
    await clickDay('2027-03-04');
    expect(getValues()).toBe('2027-03-04|2027-03-04');
  });

  it('forgets a staged start date and the month navigated to once the picker is dismissed', async () => {
    // A committed multi-day range reopens in range mode, so the dismissal is what has to clear it.
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-14" />);

    await openPicker();
    await goToNextMonth();
    await clickDay('2026-08-20');
    await userEvent.keyboard('{Escape}');

    await openPicker();
    expect(getMonthLabel()).toBe('July 2026');
    // Without the staged start, this click starts a range instead of completing 08/20 - 07/25.
    await clickDay('2026-07-25');
    expect(getValues()).toBe('2026-07-10|2026-07-14');

    await clickDay('2026-07-27');
    expect(getValues()).toBe('2026-07-25|2026-07-27');
  });

  it('caps the end date at maxRangeDays days after the staged start date', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-10" />);

    await openPicker();
    await enableRangeMode();
    await clickDay('2026-07-13');
    await goToNextMonth();

    // 45 days after 07/13 is 08/27, so the following day cannot close the range.
    expect(getDay('2026-08-27')).toBeEnabled();
    expect(getDay('2026-08-28')).toBeDisabled();

    // A valid preview is cleared when the cursor moves onto an unselectable cell.
    await hoverCell('2026-08-27');
    expect(bandOf('2026-08-27')).toBe('preview');
    await hoverCell('2026-08-28');
    expect(bandOf('2026-08-27')).toBeUndefined();
    expect(bandOf('2026-08-28')).toBeUndefined();
  });

  it('marks the committed range on its days and only its boundaries as selected', async () => {
    render(<Harness dateFrom="2026-07-10" dateTo="2026-07-14" />);

    await openPicker();

    expect([10, 11, 12, 13, 14].map((day) => bandOf(`2026-07-${day}`))).toEqual(Array(5).fill('range'));
    expect(bandOf('2026-07-09')).toBeUndefined();
    expect(bandOf('2026-07-15')).toBeUndefined();

    expect(getDay('2026-07-10')).toHaveAttribute('aria-selected', 'true');
    expect(getDay('2026-07-14')).toHaveAttribute('aria-selected', 'true');
    expect(getDay('2026-07-12')).toHaveAttribute('aria-selected', 'false');
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

  it.each([
    { dateFrom: '2026-07-10', dateTo: null },
    { dateFrom: null, dateTo: '2026-07-10' },
  ])('shows an inline error for an incomplete range seeded from outside the picker', async ({ dateFrom, dateTo }) => {
    render(<Harness dateFrom={dateFrom} dateTo={dateTo} />);

    await waitFor(() => {
      expect(screen.getByText('Both start and end dates are required.')).toBeVisible();
    });
  });

  it('accepts an empty externally seeded range', async () => {
    render(<Harness dateFrom={null} dateTo={null} />);

    await waitFor(() => {
      expect(screen.getByTestId(FIELD_TEST_ID)).toHaveAttribute('aria-invalid', 'false');
    });
    expect(screen.queryByText('Both start and end dates are required.')).not.toBeInTheDocument();
  });

  it('shows an inline error for an over-limit range seeded from outside the picker', async () => {
    render(<Harness dateFrom="2026-07-01" dateTo="2026-08-16" />);

    await waitFor(() => {
      expect(screen.getByText('Date range must not exceed 45 days.')).toBeVisible();
    });
  });
});
