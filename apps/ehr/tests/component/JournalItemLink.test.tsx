import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { JournalItem } from 'utils/lib/types/api/provider-journal.types';
import { TaskAlertCode, TaskAlertDisplay } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it } from 'vitest';
import { JournalItemLink } from '../../src/features/journal/components/JournalItemLink';

const NOW = DateTime.fromISO('2026-11-07T15:00:00.000Z');
const lab = (alert?: TaskAlertCode): JournalItem => ({
  id: 'task-1',
  taskId: 'task-1',
  kind: 'external-lab',
  label: 'Review Potassium',
  when: 'resulted',
  since: '2026-11-07T13:00:00.000Z',
  appointmentId: 'appt-1',
  orderId: 'sr-1',
  alert,
});

describe('JournalItemLink', () => {
  it('shows the Tasks page alert icon on an abnormal result', () => {
    render(<JournalItemLink item={lab(TaskAlertCode.abnormalLabResult)} now={NOW} onOpenChat={() => {}} />);
    expect(screen.getByLabelText(TaskAlertDisplay[TaskAlertCode.abnormalLabResult])).toBeInTheDocument();
    expect(screen.getByTestId('WarningAmberOutlinedIcon')).toBeInTheDocument();
  });

  it('shows no alert icon on a normal result', () => {
    render(<JournalItemLink item={lab()} now={NOW} onOpenChat={() => {}} />);
    expect(screen.queryByTestId('WarningAmberOutlinedIcon')).not.toBeInTheDocument();
  });
});
