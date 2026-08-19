import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockUpdate = vi.fn();
const mockDelete = vi.fn();
type MockObservation = { field: string; value?: boolean; note?: string; resourceId?: string };
let mockExamObservations: Record<string, MockObservation> = {};

vi.mock('src/features/visits/telemed/hooks/useExamObservations', () => ({
  useExamObservations: (param?: string | string[]) => {
    const value = Array.isArray(param)
      ? param.map((field) => mockExamObservations[field] ?? { field, value: false, note: '' })
      : typeof param === 'string'
      ? mockExamObservations[param] ?? { field: param, value: false, note: '' }
      : Object.values(mockExamObservations);

    return { value, update: mockUpdate, delete: mockDelete, isLoading: false, hasPendingApiRequests: false };
  },
}));

vi.mock('src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick, disabled, loading, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...rest}>
      {children}
    </button>
  ),
}));

import { ClearExamButton } from '../../src/features/visits/shared/components/exam-tab/ClearExamButton';
import {
  clearExamObservations,
  collectExamCheckboxFields,
} from '../../src/features/visits/shared/components/exam-tab/exam-selection-helpers';
import { ExamSelectAllCheckbox } from '../../src/features/visits/shared/components/exam-tab/ExamSelectAllCheckbox';

const FIELDS = ['alert', 'active', 'well-hydrated'];

const renderSelectAll = (): void => {
  render(<ExamSelectAllCheckbox sectionKey="general" fields={FIELDS} />);
};

const selectAllCheckbox = (): HTMLElement => screen.getByRole('checkbox', { name: 'Select all' });

// ============================================================================
// TESTS
// ============================================================================

describe('collectExamCheckboxFields', () => {
  it('collects plain checkboxes and recurses into columns', () => {
    expect(
      collectExamCheckboxFields({
        alert: { type: 'checkbox', label: 'Alert' },
        'right-eye': {
          type: 'column',
          label: 'Right eye',
          components: { 'right-eye-clear': { type: 'checkbox', label: 'Clear' } },
        },
        comment: { type: 'text', label: 'Comment' },
      } as any)
    ).toEqual(['alert', 'right-eye-clear']);
  });

  it('skips legacy checkboxes, which are hidden unless already set', () => {
    expect(
      collectExamCheckboxFields({
        alert: { type: 'checkbox', label: 'Alert' },
        'old-finding': { type: 'checkbox', label: 'Old finding', legacy: true },
      } as any)
    ).toEqual(['alert']);
  });
});

describe('clearExamObservations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const comment = { field: 'general-comment', note: 'looks fine', resourceId: 'obs-general-comment' };

  it('leaves provider comments alone by default, so a section Select all only owns its checkboxes', () => {
    clearExamObservations([comment], mockDelete);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('deletes provider comments when includeNotes is set', () => {
    clearExamObservations([comment], mockDelete, { includeNotes: true });

    expect(mockDelete).toHaveBeenCalledWith([
      expect.objectContaining({ field: 'general-comment', resourceId: 'obs-general-comment' }),
    ]);
  });
});

describe('ExamSelectAllCheckbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExamObservations = {};
  });

  it('checks every unselected field of the section in a single update', async () => {
    const user = userEvent.setup();
    mockExamObservations = { active: { field: 'active', value: true, resourceId: 'obs-active' } };

    renderSelectAll();
    await user.click(selectAllCheckbox());

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ field: 'alert', value: true }),
      expect.objectContaining({ field: 'well-hydrated', value: true }),
    ]);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('is indeterminate while only some fields of the section are selected', () => {
    mockExamObservations = { active: { field: 'active', value: true } };

    renderSelectAll();

    expect(selectAllCheckbox()).not.toBeChecked();
    expect(selectAllCheckbox()).toHaveAttribute('data-indeterminate', 'true');
  });

  it('is checked once every field of the section is selected, and clears them when unchecked', async () => {
    const user = userEvent.setup();
    mockExamObservations = {
      alert: { field: 'alert', value: true, resourceId: 'obs-alert' },
      active: { field: 'active', value: true, resourceId: 'obs-active' },
      'well-hydrated': { field: 'well-hydrated', value: true, resourceId: 'obs-well-hydrated' },
    };

    renderSelectAll();
    expect(selectAllCheckbox()).toBeChecked();

    await user.click(selectAllCheckbox());

    // The DTOs go through as they are; useExamObservations blanks the store entries itself.
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith([
      expect.objectContaining({ field: 'alert', resourceId: 'obs-alert' }),
      expect.objectContaining({ field: 'active', resourceId: 'obs-active' }),
      expect.objectContaining({ field: 'well-hydrated', resourceId: 'obs-well-hydrated' }),
    ]);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('ClearExamButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExamObservations = {};
  });

  it('is disabled when the exam holds neither selections nor comments', () => {
    mockExamObservations = {
      'oriented-x-3': { field: 'oriented-x-3', value: false, resourceId: 'obs-oriented' },
      'general-comment': { field: 'general-comment', note: '   ' },
    };

    render(<ClearExamButton />);

    expect(screen.getByRole('button', { name: 'Clear Exam' })).toBeDisabled();
  });

  it('is enabled by a provider comment alone', () => {
    mockExamObservations = { 'general-comment': { field: 'general-comment', note: 'looks fine' } };

    render(<ClearExamButton />);

    expect(screen.getByRole('button', { name: 'Clear Exam' })).toBeEnabled();
  });

  it('clears every selected finding and every provider comment after the confirmation is accepted', async () => {
    const user = userEvent.setup();
    mockExamObservations = {
      alert: { field: 'alert', value: true, resourceId: 'obs-alert' },
      'mild-distress': { field: 'mild-distress', value: true, resourceId: 'obs-mild-distress' },
      'oriented-x-3': { field: 'oriented-x-3', value: false, resourceId: 'obs-oriented' },
      'general-comment': { field: 'general-comment', note: 'looks fine', resourceId: 'obs-general-comment' },
    };

    render(<ClearExamButton />);
    await user.click(screen.getByRole('button', { name: 'Clear Exam' }));

    expect(screen.getByText(/Are you sure you want to clear all selected items of Exam/i)).toHaveTextContent(
      "This action can't be undone."
    );

    // Confirm — the dialog's proceed button repeats the action label.
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear Exam' }));

    // Selections and the comment go; fields that held nothing are left alone.
    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith([
        expect.objectContaining({ field: 'alert', resourceId: 'obs-alert' }),
        expect.objectContaining({ field: 'mild-distress', resourceId: 'obs-mild-distress' }),
        expect.objectContaining({ field: 'general-comment', resourceId: 'obs-general-comment' }),
      ])
    );
  });

  it('does not clear anything when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    mockExamObservations = { alert: { field: 'alert', value: true, resourceId: 'obs-alert' } };

    render(<ClearExamButton />);
    await user.click(screen.getByRole('button', { name: 'Clear Exam' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
