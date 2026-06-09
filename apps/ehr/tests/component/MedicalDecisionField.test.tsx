import { render, screen } from '@testing-library/react';
import { useChartFields } from 'src/features/visits/shared/hooks/useChartFields';
import { useDebounceNotesField } from 'src/features/visits/shared/hooks/useDebounceNotesField';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MedicalDecisionField } from '../../src/features/visits/shared/components/assessment-tab/MedicalDecisionField';

vi.mock('src/hooks/useProgressNoteConfig', () => ({
  useProgressNoteConfig: vi.fn(),
}));

vi.mock('src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: vi.fn(),
}));

vi.mock('src/features/visits/shared/hooks/useDebounceNotesField', () => ({
  useDebounceNotesField: vi.fn(),
}));

const mockUseProgressNoteConfig = vi.mocked(useProgressNoteConfig);
const mockUseChartFields = vi.mocked(useChartFields);
const mockUseDebounceNotesField = vi.mocked(useDebounceNotesField);

describe('MedicalDecisionField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChartFields.mockReturnValue({
      data: {
        medicalDecision: {
          text: '',
        },
      },
    } as any);
    mockUseDebounceNotesField.mockReturnValue({
      onValueChange: vi.fn(),
      isLoading: false,
    } as any);
  });

  it('renders the label with an asterisk when mdmRequired is true', () => {
    mockUseProgressNoteConfig.mockReturnValue({
      data: {
        mdmRequired: true,
      },
    } as any);

    render(<MedicalDecisionField loading={false} setIsUpdating={vi.fn()} />);

    expect(screen.getByLabelText('Medical Decision Making *')).toBeInTheDocument();
  });

  it('renders the label without an asterisk when mdmRequired is false', () => {
    mockUseProgressNoteConfig.mockReturnValue({
      data: {
        mdmRequired: false,
      },
    } as any);

    render(<MedicalDecisionField loading={false} setIsUpdating={vi.fn()} />);

    expect(screen.getByLabelText('Medical Decision Making')).toBeInTheDocument();
    expect(screen.queryByLabelText('Medical Decision Making *')).not.toBeInTheDocument();
  });

  it('defaults to required (asterisk shown) when the config has not loaded', () => {
    mockUseProgressNoteConfig.mockReturnValue({
      data: undefined,
    } as any);

    render(<MedicalDecisionField loading={false} setIsUpdating={vi.fn()} />);

    expect(screen.getByLabelText('Medical Decision Making *')).toBeInTheDocument();
  });
});
