import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE } from 'utils/lib/types/data/get-patient-medical-record.types';
import { describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { MedicalRecordDateRangeDialog } from '../../src/features/medical-record-export/components/MedicalRecordDateRangeDialog';

const ids = dataTestIds.medicalRecordDateRangeDialog;
const FIRST_VISIT = DateTime.local(2026, 1, 15);
const TODAY = DateTime.now().toFormat('MM/dd/yyyy');

const renderDialog = (
  overrides: Partial<Parameters<typeof MedicalRecordDateRangeDialog>[0]> = {}
): { onConfirm: ReturnType<typeof vi.fn>; onClose: ReturnType<typeof vi.fn> } => {
  const onConfirm = vi.fn(() => Promise.resolve());
  const onClose = vi.fn();
  render(
    <MedicalRecordDateRangeDialog
      open
      confirmText="Download Archive"
      defaultFrom={FIRST_VISIT}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />
  );
  return { onConfirm, onClose };
};

const typeDate = async (
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  digits: string
): Promise<void> => {
  await user.click(input);
  await user.keyboard('{Backspace}');
  await user.keyboard(digits);
};

const clearDate = async (user: ReturnType<typeof userEvent.setup>, input: HTMLElement): Promise<void> => {
  await user.click(input);
  await user.keyboard('{Control>}a{/Control}{Backspace}');
};

describe('MedicalRecordDateRangeDialog', () => {
  it('predefines the range from the first visit to today', () => {
    renderDialog();

    expect(screen.getByText('Medical Record')).toBeInTheDocument();
    expect(screen.getByText('Dates predefined to include all available records.')).toBeInTheDocument();
    expect(screen.getByTestId(ids.fromInput)).toHaveValue('01/15/2026');
    expect(screen.getByTestId(ids.toInput)).toHaveValue(TODAY);
  });

  it('labels the confirm button after the action that opened it', () => {
    renderDialog({ confirmText: 'Send as Fax' });

    expect(screen.getByTestId(ids.confirmButton)).toHaveTextContent('Send as Fax');
  });

  it('requests the predefined range, from the start of the first visit day to the end of today', async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderDialog();

    await user.click(screen.getByTestId(ids.confirmButton));

    expect(onConfirm).toHaveBeenCalledWith({
      from: FIRST_VISIT.startOf('day').toISO(),
      to: DateTime.now().endOf('day').toISO(),
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('requests both bounds when the user changes only one', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await typeDate(user, screen.getByTestId(ids.toInput), '03312026');
    expect(screen.getByTestId(ids.toInput)).toHaveValue('03/31/2026');
    await user.click(screen.getByTestId(ids.confirmButton));

    expect(onConfirm).toHaveBeenCalledWith({
      from: FIRST_VISIT.startOf('day').toISO(),
      to: DateTime.local(2026, 3, 31).endOf('day').toISO(),
    });
  });

  it('covers a single whole day when From and To are the same date', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await typeDate(user, screen.getByTestId(ids.toInput), '01152026');
    await user.click(screen.getByTestId(ids.confirmButton));

    expect(onConfirm).toHaveBeenCalledWith({
      from: '2026-01-15T00:00:00.000' + FIRST_VISIT.toFormat('ZZ'),
      to: '2026-01-15T23:59:59.999' + FIRST_VISIT.toFormat('ZZ'),
    });
  });

  it('cannot be confirmed with a start even one day after the end', async () => {
    const user = userEvent.setup();
    renderDialog();

    await typeDate(user, screen.getByTestId(ids.toInput), '01142026');
    expect(screen.getByTestId(ids.confirmButton)).toBeDisabled();

    await typeDate(user, screen.getByTestId(ids.toInput), '01152026');
    expect(screen.getByTestId(ids.confirmButton)).toBeEnabled();
  });

  it.each([
    ['From', ids.fromInput],
    ['To', ids.toInput],
  ])('cannot be confirmed once %s is cleared', async (_label, testId) => {
    const user = userEvent.setup();
    renderDialog();

    await clearDate(user, screen.getByTestId(testId));

    expect(screen.getByTestId(testId)).toHaveValue('MM/DD/YYYY');
    expect(screen.getByTestId(ids.confirmButton)).toBeDisabled();
  });

  it('stays open with the reason when nothing can be sent, until the dates change', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.reject(new Error(NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE)));
    const { onClose } = renderDialog({ onConfirm });

    await user.click(screen.getByTestId(ids.confirmButton));

    expect(await screen.findByTestId(ids.message)).toHaveTextContent(NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();

    await typeDate(user, screen.getByTestId(ids.fromInput), '01012025');

    expect(screen.queryByTestId(ids.message)).not.toBeInTheDocument();
  });

  it('starts with an empty From for a patient with no visits and waits for one to be chosen', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ defaultFrom: null });

    expect(screen.getByTestId(ids.fromInput)).toHaveValue('');
    expect(screen.getByTestId(ids.toInput)).toHaveValue(TODAY);
    expect(screen.getByTestId(ids.confirmButton)).toBeDisabled();

    await typeDate(user, screen.getByTestId(ids.fromInput), '02012026');
    await user.click(screen.getByTestId(ids.confirmButton));

    expect(onConfirm).toHaveBeenCalledWith({
      from: DateTime.local(2026, 2, 1).toISO(),
      to: DateTime.now().endOf('day').toISO(),
    });
  });
});
