import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useSuccessQuery } from 'utils';
import { ClaimsQueueGetResponse } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { Oystehr_RCM_APIClient } from '../../data';
import { useClaimsQueueStore } from './claims-queue.store';

export const useGetClaims = ({
  apiClient,
  onSuccess,
}: {
  apiClient: Oystehr_RCM_APIClient | null;
  onSuccess?: (data: ClaimsQueueGetResponse | null) => void;
}): UseQueryResult<ClaimsQueueGetResponse, Error> => {
  const params = getSelectors(useClaimsQueueStore, [
    'patient',
    'visitId',
    'claimId',
    'teamMember',
    'queue',
    'dayInQueue',
    'status',
    'state',
    'facilityGroup',
    'facility',
    'insurance',
    'balance',
    'dosFrom',
    'dosTo',
    'offset',
    'pageSize',
  ]);

  const queryResult = useQuery({
    queryKey: ['rcm-claims-queue', apiClient, params],

    queryFn: () => {
      if (apiClient) {
        return apiClient.getClaims(params);
      }
      throw new Error('api client not defined');
    },

    enabled: !!apiClient,
  });

  useSuccessQuery(queryResult.data, onSuccess);

  return queryResult;
};
