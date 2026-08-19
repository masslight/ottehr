import { Table, TableBody } from '@mui/material';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockUpdate = vi.fn();
type MockObservation = { field: string; label?: string; value?: boolean; resourceId?: string };
let mockRosObservations: Record<string, MockObservation> = {};
let mockPendingFields: string[] = [];

vi.mock('src/features/visits/shared/hooks/useRosObservations', () => ({
  useRosObservations: () => ({
    observationMap: mockRosObservations,
    update: mockUpdate,
    isLoading: false,
    isFieldPending: (field: string) => mockPendingFields.includes(field),
  }),
}));

vi.mock('src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick, disabled, loading, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...rest}>
      {children}
    </button>
  ),
}));

import { ClearRosButton } from '../../src/features/visits/shared/components/ros-tab/ClearRosButton';
import { RosSelectAllRow } from '../../src/features/visits/shared/components/ros-tab/RosSelectAllRow';

const ITEMS = {
  'ros-constitutional-fever': { label: 'Fever' },
  'ros-constitutional-chills': { label: 'Chills' },
};

const inTable = (children: ReactNode): JSX.Element => (
  <Table>
    <TableBody>{children}</TableBody>
  </Table>
);

const selectAllCheckbox = (): HTMLElement => screen.getByRole('checkbox');

// ============================================================================
// TESTS
// ============================================================================

describe('RosSelectAllRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRosObservations = {};
    mockPendingFields = [];
  });

  it('denies every finding of the system and clears the paired reports', async () => {
    const user = userEvent.setup();
    mockRosObservations = {
      'ros-constitutional-chills-reports': {
        field: 'ros-constitutional-chills-reports',
        label: 'Chills',
        value: true,
        resourceId: 'obs-chills-reports',
      },
    };

    render(inTable(<RosSelectAllRow items={ITEMS} />));
    expect(selectAllCheckbox()).not.toBeChecked();

    await user.click(selectAllCheckbox());

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ field: 'ros-constitutional-fever-denies', label: 'Fever', value: true }),
      expect.objectContaining({ field: 'ros-constitutional-chills-denies', label: 'Chills', value: true }),
      expect.objectContaining({
        field: 'ros-constitutional-chills-reports',
        value: false,
        resourceId: 'obs-chills-reports',
      }),
    ]);
  });

  it('is indeterminate while only some findings of the system are denied', () => {
    mockRosObservations = {
      'ros-constitutional-fever-denies': { field: 'ros-constitutional-fever-denies', value: true },
    };

    render(inTable(<RosSelectAllRow items={ITEMS} />));

    expect(selectAllCheckbox()).not.toBeChecked();
    expect(selectAllCheckbox()).toHaveAttribute('data-indeterminate', 'true');
  });

  it('is checked once every finding is denied, and clears the denials when unchecked', async () => {
    const user = userEvent.setup();
    mockRosObservations = {
      'ros-constitutional-fever-denies': {
        field: 'ros-constitutional-fever-denies',
        value: true,
        resourceId: 'obs-fever-denies',
      },
      'ros-constitutional-chills-denies': {
        field: 'ros-constitutional-chills-denies',
        value: true,
        resourceId: 'obs-chills-denies',
      },
    };

    render(inTable(<RosSelectAllRow items={ITEMS} />));
    expect(selectAllCheckbox()).toBeChecked();

    await user.click(selectAllCheckbox());

    expect(mockUpdate).toHaveBeenCalledWith([
      expect.objectContaining({
        field: 'ros-constitutional-fever-denies',
        value: false,
        resourceId: 'obs-fever-denies',
      }),
      expect.objectContaining({
        field: 'ros-constitutional-chills-denies',
        value: false,
        resourceId: 'obs-chills-denies',
      }),
    ]);
  });
});

describe('ClearRosButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRosObservations = {};
    mockPendingFields = [];
  });

  it('is disabled when nothing is selected', () => {
    mockRosObservations = {
      'ros-constitutional-fever-denies': {
        field: 'ros-constitutional-fever-denies',
        value: false,
        resourceId: 'obs-fever-denies',
      },
    };

    render(<ClearRosButton />);

    expect(screen.getByRole('button', { name: 'Clear ROS' })).toBeDisabled();
  });

  it('waits on a selected field that another component is still writing', () => {
    mockRosObservations = {
      'ros-constitutional-fever-denies': {
        field: 'ros-constitutional-fever-denies',
        value: true,
        resourceId: 'obs-fever-denies',
      },
    };
    // A row toggle or a system "Select all" fired elsewhere: this hook instance's own isLoading
    // says nothing about it, so the button has to read the shared pending fields.
    mockPendingFields = ['ros-constitutional-fever-denies'];

    render(<ClearRosButton />);

    expect(screen.getByRole('button', { name: 'Clear ROS' })).toBeDisabled();
  });

  it('clears both denies and reports selections after the confirmation is accepted', async () => {
    const user = userEvent.setup();
    mockRosObservations = {
      'ros-constitutional-fever-denies': {
        field: 'ros-constitutional-fever-denies',
        value: true,
        resourceId: 'obs-fever-denies',
      },
      'ros-eyes-redness-reports': {
        field: 'ros-eyes-redness-reports',
        value: true,
        resourceId: 'obs-redness-reports',
      },
      'ros-eyes-itching-denies': { field: 'ros-eyes-itching-denies', value: false, resourceId: 'obs-itching-denies' },
    };

    render(<ClearRosButton />);
    await user.click(screen.getByRole('button', { name: 'Clear ROS' }));

    expect(
      screen.getByText(/Are you sure you want to clear all selected items of Review of Systems/i)
    ).toHaveTextContent("This action can't be undone.");

    // The dialog's proceed button repeats the action label.
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear ROS' }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith([
        expect.objectContaining({ field: 'ros-constitutional-fever-denies', value: false }),
        expect.objectContaining({ field: 'ros-eyes-redness-reports', value: false }),
      ])
    );
  });

  it('does not clear anything when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    mockRosObservations = {
      'ros-constitutional-fever-denies': {
        field: 'ros-constitutional-fever-denies',
        value: true,
        resourceId: 'obs-fever-denies',
      },
    };

    render(<ClearRosButton />);
    await user.click(screen.getByRole('button', { name: 'Clear ROS' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
