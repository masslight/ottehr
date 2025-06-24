import { useQuery } from 'react-query';
import { ClaimsQueueGetResponse } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { ZapEHR_RCM_APIClient } from '../../data';
import { useClaimsQueueStore } from './claims-queue.store';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const useGetClaims = ({
  apiClient,
  onSuccess,
}: {
  apiClient: ZapEHR_RCM_APIClient | null;
  onSuccess?: (data: ClaimsQueueGetResponse) => void;
}) => {
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
