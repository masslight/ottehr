import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAppointmentAccessibility, mockUseMainEncounterChartData, mockUseChartData } = vi.hoisted(() => ({
  mockUseAppointmentAccessibility: vi.fn(),
  mockUseMainEncounterChartData: vi.fn(),
  mockUseChartData: vi.fn(),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: mockUseAppointmentAccessibility,
}));

vi.mock('src/features/visits/shared/hooks/useMainEncounterChartData', () => ({
  useMainEncounterChartData: mockUseMainEncounterChartData,
}));

vi.mock('src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: mockUseChartData,
}));

import { useImmunizationDiagnosisOptions } from '../../src/features/immunization/hooks/useImmunizationDiagnosisOptions';

const CURRENT_ENCOUNTER_DX = { resourceId: 'cond-current', code: 'J45.909', display: 'Asthma' };
const MAIN_ENCOUNTER_DX = { resourceId: 'cond-main', code: 'O29.011', display: 'Anesthesia complication' };

describe('useImmunizationDiagnosisOptions — Associated Dx options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sources Associated Dx from the current encounter chart data on a non-follow-up visit', () => {
    mockUseAppointmentAccessibility.mockReturnValue({ visitType: 'in-person' });
    mockUseChartData.mockReturnValue({ chartData: { diagnosis: [CURRENT_ENCOUNTER_DX] } });
    mockUseMainEncounterChartData.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useImmunizationDiagnosisOptions());

    expect(result.current).toEqual([{ resourceId: 'cond-current', display: 'J45.909 - Asthma' }]);
    expect(mockUseMainEncounterChartData).toHaveBeenCalledWith(false);
  });

  it('sources Associated Dx from the main encounter chart data on an annotation follow-up visit', () => {
    mockUseAppointmentAccessibility.mockReturnValue({ visitType: 'follow-up' });
    mockUseChartData.mockReturnValue({ chartData: { diagnosis: [CURRENT_ENCOUNTER_DX] } });
    mockUseMainEncounterChartData.mockReturnValue({ data: { diagnosis: [MAIN_ENCOUNTER_DX] } });

    const { result } = renderHook(() => useImmunizationDiagnosisOptions());

    expect(result.current).toEqual([{ resourceId: 'cond-main', display: 'O29.011 - Anesthesia complication' }]);
    expect(mockUseMainEncounterChartData).toHaveBeenCalledWith(true);
  });

  it('leaves out diagnoses without a resource id', () => {
    mockUseAppointmentAccessibility.mockReturnValue({ visitType: 'in-person' });
    mockUseChartData.mockReturnValue({ chartData: { diagnosis: [{ code: 'Z23', display: 'Immunization' }] } });
    mockUseMainEncounterChartData.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useImmunizationDiagnosisOptions());

    expect(result.current).toEqual([]);
  });
});
