import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrescriptionsOptions } from '../../src/features/tasks/common';

const mocks = vi.hoisted(() => ({ useChartSection: vi.fn() }));

vi.mock('../../src/features/visits/shared/hooks/useChartSection', () => ({ useChartSection: mocks.useChartSection }));

describe('New task: a patient’s refill request picks the prescription', () => {
  beforeEach(() => {
    mocks.useChartSection.mockReturnValue({
      isLoading: false,
      data: {
        prescribedMedications: [
          { resourceId: 'rx-1', name: 'Sertraline 50 mg tablet', sent: '2026-08-03T15:00:00.000Z' },
          { resourceId: 'rx-2', name: 'Lisinopril 10 mg tablet' },
        ],
      },
    });
  });

  it('lists the visit’s eRx prescriptions by name and date, each by its MedicationRequest', () => {
    const { result } = renderHook(() => usePrescriptionsOptions('encounter-1'));
    expect(mocks.useChartSection).toHaveBeenCalledWith('plan', { encounterId: 'encounter-1' });
    expect(result.current.prescriptionsOptions).toEqual([
      { id: 'rx-1', label: 'Sertraline 50 mg tablet · 8/3/2026' },
      { id: 'rx-2', label: 'Lisinopril 10 mg tablet' },
    ]);
  });
});
