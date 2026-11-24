import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetRadiologyOrders, mockSavePreliminaryReport, apiClients } = vi.hoisted(() => ({
  mockGetRadiologyOrders: vi.fn(),
  mockSavePreliminaryReport: vi.fn(),
  apiClients: { oystehrZambda: {} },
}));

vi.mock('src/api/api', () => ({
  cancelRadiologyOrder: vi.fn(),
  getRadiologyOrders: mockGetRadiologyOrders,
  saveFinalReport: vi.fn(),
  savePreliminaryReport: mockSavePreliminaryReport,
  sendForFinalRead: vi.fn(),
  updateRadiologyOrder: vi.fn(),
  updateRadiologyReport: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => apiClients,
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/features/radiology/components/useDeleteRadiologyOrderDialog', () => ({
  useDeleteRadiologyOrderDialog: () => ({ showDeleteRadiologyOrderDialog: vi.fn(), DeleteOrderDialog: null }),
}));

import { usePatientRadiologyOrders } from '../../src/features/radiology/components/usePatientRadiologyOrders';

const SERVICE_REQUEST_ID = 'sr-001';

describe('usePatientRadiologyOrders - saving a preliminary read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRadiologyOrders.mockResolvedValue({ orders: [], pagination: undefined });
    mockSavePreliminaryReport.mockRejectedValue(new Error('could not be marked as final'));
  });

  const renderOrders = async (): Promise<ReturnType<typeof usePatientRadiologyOrders>> => {
    const { result } = renderHook(() => usePatientRadiologyOrders({ serviceRequestId: SERVICE_REQUEST_ID }));
    await waitFor(() => expect(mockGetRadiologyOrders).toHaveBeenCalledTimes(1));
    return result.current;
  };

  it('reloads the order when marking the read as final fails, since the read itself may have been saved', async () => {
    const { handleSaveReport } = await renderOrders();

    await act(() => handleSaveReport(SERVICE_REQUEST_ID, 'Read', 'preliminary', ['A00'], 'practitioner-1', true));

    expect(mockSavePreliminaryReport).toHaveBeenCalledWith(expect.anything(), {
      serviceRequestId: SERVICE_REQUEST_ID,
      report: 'Read',
      diagnosisCodes: ['A00'],
      performedById: 'practitioner-1',
      markAsFinal: true,
    });
    expect(mockGetRadiologyOrders).toHaveBeenCalledTimes(2);
  });

  it('leaves the order as it was when a plain preliminary read fails to save', async () => {
    const { handleSaveReport } = await renderOrders();

    await act(() => handleSaveReport(SERVICE_REQUEST_ID, 'Read', 'preliminary', ['A00'], 'practitioner-1', false));

    expect(mockGetRadiologyOrders).toHaveBeenCalledTimes(1);
  });
});
