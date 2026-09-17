import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let schoolWorkNotes: { type: string; url: string }[] = [];
let presignedFiles: { type: string; presignedUrl?: string }[] = [];

vi.mock('src/shared/hooks/useExcusePresignedFiles', () => ({
  useExcusePresignedFiles: () => presignedFiles,
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({ chartData: { schoolWorkNotes } }),
}));

vi.mock('src/features/visits/shared/hooks/useProgressNoteChartFields', () => ({
  useProgressNoteChartFields: () => ({ data: {} }),
}));

import { usePatientInstructionsVisibility } from '../../src/features/visits/shared/hooks/usePatientInstructionsVisibility';

describe('usePatientInstructionsVisibility', () => {
  beforeEach(() => {
    schoolWorkNotes = [{ type: 'work', url: 'z3://work-note' }];
    presignedFiles = [];
  });

  it('shows the excuse section once a note has a presigned URL', () => {
    presignedFiles = [{ type: 'work', presignedUrl: 'https://example.test/work-note' }];

    const { result } = renderHook(() => usePatientInstructionsVisibility());

    expect(result.current.showSchoolWorkExcuse).toBe(true);
  });

  it('hides the excuse section when every note failed to presign', () => {
    presignedFiles = [{ type: 'work' }];

    const { result } = renderHook(() => usePatientInstructionsVisibility());

    expect(result.current.showSchoolWorkExcuse).toBe(false);
    expect(result.current.showPatientInstructions).toBe(false);
  });
});
