import { useQuery, UseQueryResult } from 'react-query';
import { ClaimsQueueGetResponse } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { Oystehr_RCM_APIClient } from '../../data';
import { useClaimsQueueStore } from './claims-queue.store';

export const useGetClaims = ({
  apiClient,
  onSuccess,
}: {
  apiClient: Oystehr_RCM_APIClient | null;
  onSuccess?: (data: ClaimsQueueGetResponse) => void;
}): UseQueryResult<ClaimsQueueGetResponse, unknown> => {
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

  return useQuery(
    ['rcm-claims-queue', apiClient, params],
    () => {
      if (apiClient) {
        return apiClient.getClaims(params);
      }
      throw new Error('api client not defined');
    },
    {
      onError: (err) => {
        console.error('Error during fetching get claims: ', err);
      },
      onSuccess,
      enabled: !!apiClient,
    }
  );
};
