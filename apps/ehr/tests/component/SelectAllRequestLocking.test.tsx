import { Table, TableBody } from '@mui/material';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferredMutation, DeferredCall, settleAll } from './helpers/deferred-chart-data-mutations';

// ============================================================================
// MOCKS
// ============================================================================
//
// Only the chart-data mutations are mocked, so these tests exercise the real hooks and the real
// pending-fields store. `isPending` is pinned to false on purpose: the per-call-site mutation state
// is exactly what used to leave the individual checkboxes clickable during a bulk write, so it must
// not be what makes these assertions pass.

const calls: DeferredCall[] = [];

const mutateAsync = createDeferredMutation(calls);

// react-query drops the callbacks handed to `mutate` once the calling component has unmounted or
// has fired another mutation on the same hook instance, so the mock reproduces that worst case by
// never calling them: the pending-fields bookkeeping must not depend on them.
const mutate = vi.fn((_variables: unknown, _options?: unknown) => undefined);

const settleAllRequests = (): Promise<void> => settleAll(calls);

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useSaveChartData: () => ({ mutate, mutateAsync, isPending: false }),
  useDeleteChartData: () => ({ mutate, mutateAsync, isPending: false }),
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { ClearExamButton } from '../../src/features/visits/shared/components/exam-tab/ClearExamButton';
import { ControlledExamCheckbox } from '../../src/features/visits/shared/components/exam-tab/ControlledExamCheckbox';
import { ExamCommentField } from '../../src/features/visits/shared/components/exam-tab/ExamCommentField';
import { ExamSelectAllCheckbox } from '../../src/features/visits/shared/components/exam-tab/ExamSelectAllCheckbox';
import { RosSelectAllRow } from '../../src/features/visits/shared/components/ros-tab/RosSelectAllRow';
import { RosTableRow } from '../../src/features/visits/shared/components/ros-tab/RosTableRow';
import { useExamObservationsStore } from '../../src/features/visits/shared/stores/appointment/exam-observations.store';
import {
  resetPendingObservationFields,
  usePendingObservationFieldsStore,
} from '../../src/features/visits/shared/stores/appointment/pending-observation-fields.store';
import { useRosObservationsStore } from '../../src/features/visits/shared/stores/appointment/ros-observations.store';
import { useExamObservations } from '../../src/features/visits/telemed/hooks/useExamObservations';

// ============================================================================
// TESTS
// ============================================================================

describe('Exam "Select all" request locking', () => {
  const EXAM_FIELDS = ['alert', 'active'];

  const ExamSection = (): JSX.Element => (
    <>
      <ExamSelectAllCheckbox sectionKey="general" fields={EXAM_FIELDS} />
      <ControlledExamCheckbox name="alert" label="Alert" />
      <ControlledExamCheckbox name="active" label="Active" />
    </>
  );

  const checkbox = (name: string): HTMLElement => screen.getByRole('checkbox', { name });

  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    useExamObservationsStore.setState({}, true);
    resetPendingObservationFields();
  });

  it('disables every checkbox of the section while the Select all request is in flight', async () => {
    const user = userEvent.setup();
    render(<ExamSection />);

    await user.click(checkbox('Select all'));
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // The whole section is locked, so the in-flight response cannot clobber a later click.
    expect(checkbox('Select all')).toBeDisabled();
    expect(checkbox('Alert')).toBeDisabled();
    expect(checkbox('Active')).toBeDisabled();
  });

  it('re-enables the section once the request settles', async () => {
    const user = userEvent.setup();
    render(<ExamSection />);

    await user.click(checkbox('Select all'));
    await settleAllRequests();

    expect(checkbox('Select all')).toBeEnabled();
    expect(checkbox('Alert')).toBeEnabled();
    expect(checkbox('Active')).toBeEnabled();
  });

  it('locks only the clicked field, plus the Select all that would rewrite it, on a single toggle', async () => {
    const user = userEvent.setup();
    render(<ExamSection />);

    await user.click(checkbox('Alert'));

    expect(checkbox('Alert')).toBeDisabled();
    expect(checkbox('Select all')).toBeDisabled();
    // Untouched siblings stay live — a single toggle must not freeze the whole exam.
    expect(checkbox('Active')).toBeEnabled();
  });
});

describe('ROS "Select all" request locking', () => {
  const ITEMS = {
    'ros-constitutional-fever': { label: 'Fever' },
    'ros-constitutional-chills': { label: 'Chills' },
  };

  const RosSystem = (): JSX.Element => (
    <Table>
      <TableBody>
        <RosSelectAllRow items={ITEMS} />
        {Object.entries(ITEMS).map(([baseKey, item]) => (
          <RosTableRow key={baseKey} baseKey={baseKey} item={item} />
        ))}
      </TableBody>
    </Table>
  );

  const findingCheckbox = (label: string, column: 'denies' | 'reports'): HTMLElement => {
    const row = screen.getByRole('row', { name: new RegExp(label) });
    const cell =
      column === 'denies'
        ? dataTestIds.reviewOfSystemsPage.deniesCheckboxCell
        : dataTestIds.reviewOfSystemsPage.reportsCheckboxCell;
    return within(within(row).getByTestId(cell)).getByRole('checkbox');
  };

  const selectAllCheckbox = (): HTMLElement =>
    within(screen.getByTestId(dataTestIds.reviewOfSystemsPage.selectAllDeniesCell)).getByRole('checkbox');

  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    useRosObservationsStore.setState({}, true);
    resetPendingObservationFields();
  });

  it('disables every finding of the system while the Select all request is in flight', async () => {
    const user = userEvent.setup();
    render(<RosSystem />);

    await user.click(selectAllCheckbox());
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    expect(selectAllCheckbox()).toBeDisabled();
    expect(findingCheckbox('Fever', 'denies')).toBeDisabled();
    expect(findingCheckbox('Fever', 'reports')).toBeDisabled();
    expect(findingCheckbox('Chills', 'denies')).toBeDisabled();
    expect(findingCheckbox('Chills', 'reports')).toBeDisabled();
  });

  it('re-enables the system once the request settles', async () => {
    const user = userEvent.setup();
    render(<RosSystem />);

    await user.click(selectAllCheckbox());
    await settleAllRequests();

    expect(selectAllCheckbox()).toBeEnabled();
    expect(findingCheckbox('Fever', 'denies')).toBeEnabled();
    expect(findingCheckbox('Chills', 'reports')).toBeEnabled();
  });

  it('locks a single toggled finding and the Select all, but not the other findings', async () => {
    const user = userEvent.setup();
    render(<RosSystem />);

    await user.click(findingCheckbox('Fever', 'denies'));

    // Both columns of the toggled row lock, because checking one clears the other.
    expect(findingCheckbox('Fever', 'denies')).toBeDisabled();
    expect(findingCheckbox('Fever', 'reports')).toBeDisabled();
    expect(selectAllCheckbox()).toBeDisabled();
    expect(findingCheckbox('Chills', 'denies')).toBeEnabled();
  });
});

describe('Clearing the exam while a write is only queued', () => {
  const ExamWithComment = (): JSX.Element => (
    <>
      <ExamCommentField name="general-comment" />
      <ClearExamButton />
    </>
  );

  const clearExamButton = (): HTMLElement => screen.getByRole('button', { name: 'Clear Exam' });

  const heldFields = (): Record<string, number> => usePendingObservationFieldsStore.getState().counts;

  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    // A selected finding, so "Clear Exam" is only ever disabled by a write it must not race.
    useExamObservationsStore.setState({ alert: { field: 'alert', value: true, resourceId: 'obs-alert' } }, true);
    resetPendingObservationFields();
  });

  it('locks the exam from the keystroke on, not from the moment the request leaves', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ExamWithComment />);

    expect(clearExamButton()).toBeEnabled();

    await user.type(screen.getByRole('textbox'), 'well appearing');

    // Mid-debounce: nothing has been sent yet, but a write is coming. Clearing here would delete the
    // comment's Observation and then watch the debounced save write it straight back, against the id
    // that was just deleted.
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(clearExamButton()).toBeDisabled();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(clearExamButton()).toBeDisabled();

    await settleAllRequests();
    expect(clearExamButton()).toBeEnabled();
  });

  it('keeps a note write counted while it waits for the resourceId of the one in flight', async () => {
    const { result } = renderHook(() => useExamObservations());

    act(() => result.current.update({ field: 'general-comment', note: 'a' }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // The second write is parked on the hook's requeue timer rather than sent, so that it can pick
    // up the resourceId the first one is about to return.
    act(() => result.current.update({ field: 'general-comment', note: 'ab' }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    await settleAllRequests();

    // The request is done but the queued write is not, so the field still has to read as busy.
    expect(heldFields()['general-comment']).toBeGreaterThan(0);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2), { timeout: 5000 });
    await settleAllRequests();

    expect(heldFields()).toEqual({});
  });
});

describe('Pending-field release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    useExamObservationsStore.setState({}, true);
    resetPendingObservationFields();
  });

  it('releases the fields of a bulk write whose component unmounted before it settled', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ExamSelectAllCheckbox sectionKey="general" fields={['alert', 'active']} />);

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(usePendingObservationFieldsStore.getState().counts).toEqual({ alert: 1, active: 1 });

    // Navigating away mid-save is the everyday version of this. react-query then never runs the
    // callbacks passed to `mutate`, and a release routed through them would leave these fields —
    // and every "Select all" / "Clear Exam" watching them — disabled for the rest of the session.
    unmount();
    await settleAllRequests();

    expect(usePendingObservationFieldsStore.getState().counts).toEqual({});
  });
});
