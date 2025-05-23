import { useCallback, useState, useEffect } from 'react';
import { useApiClients } from '../../../../hooks/useAppClients';
import { NursingOrdersStatus } from '../../nursingOrderTypes';

// Mock function for getNursingOrders
export const getNursingOrders = async (_oystehrZambda: any): Promise<{ data: any[] }> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock data matching your hook's expected structure
  const mockData = [
    {
      serviceRequestId: '123',
      order:
        'Offer ice pop for comfort and hydration. Indicated for sore throat and/or post-febrile care. Monitor tolerance and document intake.',
      orderAddedDate: '2025-05-27T10:17:00.000Z',
      orderingPhysician: 'Tom Smith, MD',
      orderStatus: NursingOrdersStatus.pending,
    },
    {
      serviceRequestId: '456',
      order:
        'Administer oral rehydration solution as needed. Monitor patient hydration status and document fluid intake.',
      orderAddedDate: '2025-05-27T11:30:00.000Z',
      orderingPhysician: 'Sarah Johnson, MD',
      orderStatus: NursingOrdersStatus.completed,
    },
    {
      serviceRequestId: '789',
      order:
        'Apply cold compress to affected area for 15 minutes every 2 hours. Document patient response and comfort level.',
      orderAddedDate: '2025-05-27T09:45:00.000Z',
      orderingPhysician: 'Michael Chen, MD',
      orderStatus: NursingOrdersStatus.cancelled,
    },
  ];

  return {
    data: mockData,
  };
};

export const useNursingOrders = (): any => {
  const { oystehrZambda } = useApiClients();
  const [nursingOrders, setNursingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchNursingOrders = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      console.error('oystehrZambda is not defined');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response;
      try {
        response = await getNursingOrders(oystehrZambda);
      } catch (err) {
        console.error('Error fetching nursing orders:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      }

      if (response?.data) {
        setNursingOrders(response.data as any[]);
      } else {
        setNursingOrders([]);
      }
    } catch (error) {
      console.error('error with setting nursing orders:', error);
      setError(error instanceof Error ? error : new Error('Unknown error occurred'));
      setNursingOrders([]);
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda]);

  // Initial fetch of nursing orders
  useEffect(() => {
    void fetchNursingOrders();
  }, [fetchNursingOrders]);

  return {
    nursingOrders,
    loading,
    error,
    fetchNursingOrders,
  };
};
