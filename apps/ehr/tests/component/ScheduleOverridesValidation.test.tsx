import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { BLANK_SCHEDULE_JSON_TEMPLATE, ScheduleExtension } from 'utils/lib/utils/scheduleUtils';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleOverridesComponent } from '../../src/components/schedule/ScheduleOverridesComponent';
import { ClosureType } from '../../src/types/types';

const CONFIRM_DIALOG_TITLE = 'Schedule change may affect visits';

const renderOverrides = (
  model: ScheduleExtension
): { update: ReturnType<typeof vi.fn>; setToastMessage: ReturnType<typeof vi.fn> } => {
  const update = vi.fn().mockResolvedValue(undefined);
  const setToastMessage = vi.fn();

  const Harness = (): ReactElement => (
    <MemoryRouter>
      <ScheduleOverridesComponent
        model={model}
        dayOfWeek="monday"
        loading={false}
        update={update}
        setToastMessage={setToastMessage}
        setToastType={vi.fn()}
        setSnackbarOpen={vi.fn()}
        ownerType="Location"
      />
    </MemoryRouter>
  );

  render(<Harness />);
  return { update, setToastMessage };
};

const save = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
};

describe('ScheduleOverridesComponent validation', () => {
  it('blocks saving an override row with no date picked', async () => {
    const { update, setToastMessage } = renderOverrides(BLANK_SCHEDULE_JSON_TEMPLATE);

    await userEvent.click(screen.getByRole('button', { name: 'Add override rule' }));
    await save();

    // An override is keyed by its date, so a dateless row would be persisted under a placeholder
    // key that never matches a day.
    expect(setToastMessage).toHaveBeenCalledWith('Please select a date for each schedule override');
    expect(screen.queryByText(CONFIRM_DIALOG_TITLE)).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks saving a closed date row with no start date picked', async () => {
    const { update, setToastMessage } = renderOverrides({ ...BLANK_SCHEDULE_JSON_TEMPLATE, closures: [] });

    await userEvent.click(screen.getByRole('button', { name: 'Add closed date' }));
    await save();

    // Without this the zambda rejects the whole save with its raw validation message.
    expect(setToastMessage).toHaveBeenCalledWith('Please select a start date for each closed date');
    expect(screen.queryByText(CONFIRM_DIALOG_TITLE)).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('confirms the save when every override and closed date has a date', async () => {
    const { setToastMessage } = renderOverrides({
      ...BLANK_SCHEDULE_JSON_TEMPLATE,
      scheduleOverrides: {
        '1/15/2030': { open: 8, close: 17, openingBuffer: 0, closingBuffer: 0, hours: [] },
      },
      closures: [{ start: '1/16/2030', end: '', type: ClosureType.OneDay }],
    });

    await save();

    expect(setToastMessage).not.toHaveBeenCalled();
    expect(screen.getByText(CONFIRM_DIALOG_TITLE)).toBeInTheDocument();
  });
});
