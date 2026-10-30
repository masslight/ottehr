import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OPEN_DOSESPOT, VIEW_FAX } from 'src/features/visits/in-person/hooks/useTasks';
import { Task } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: undefined }),
}));

import { TaskActionButton } from '../../src/features/tasks/components/TaskActionButton';

const makeTask = (overrides: Partial<Task>): Task => ({
  id: 'task-1',
  category: 'lab-order',
  createdDate: '2026-10-01T10:00:00.000Z',
  title: 'Collect sample',
  subtitle: '',
  status: 'ready',
  completable: true,
  ...overrides,
});

const renderButton = (task: Task): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <TaskActionButton task={task} />
    </MemoryRouter>
  );

describe('TaskActionButton', () => {
  it('renders a link action as an anchor that opens in a new tab', () => {
    const link = '/in-person/appt-1/in-house-lab-orders/sr-1/order-details';
    renderButton(makeTask({ action: { name: 'Go to Lab Test', link } }));

    const anchor = screen.getByRole('link', { name: 'Go to Lab Test' });
    expect(anchor.getAttribute('href')).toBe(link);
    expect(anchor.getAttribute('target')).toBe('_blank');
  });

  it('keeps the query string of the link', () => {
    const link = '/in-person/appt-1/radiology/sr-2/order-details?encounterId=enc-1';
    renderButton(makeTask({ status: 'in-progress', action: { name: 'Go to Order', link } }));

    expect(screen.getByRole('link', { name: 'Go to Order' }).getAttribute('href')).toBe(link);
  });

  it('still renders the view action of a completed fax as a link', () => {
    renderButton(makeTask({ status: 'completed', action: { name: VIEW_FAX, link: '/fax/comm-1/match' } }));

    expect(screen.getByRole('link', { name: VIEW_FAX }).getAttribute('href')).toBe('/fax/comm-1/match');
  });

  it('renders nothing for other completed tasks', () => {
    const { container } = renderButton(
      makeTask({ status: 'completed', action: { name: 'Go to task', link: '/in-person/appt-1' } })
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the action has no link', () => {
    const { container } = renderButton(makeTask({ action: { name: 'Go to task', link: '' } }));

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps Open DoseSpot as a button, since its link is fetched on click', () => {
    renderButton(makeTask({ category: 'erx', action: { name: OPEN_DOSESPOT, link: '' } }));

    expect(screen.getByRole('button', { name: OPEN_DOSESPOT })).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
