import { UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import { useInvalidatingZambdaMutation } from 'src/hooks/useInvalidatingZambdaMutation';
import {
  ListReferralsInput,
  ListReferralsOutput,
  SaveReferralInput,
  SaveReferralOutput,
  UpdateReferralStatusInput,
  UpdateReferralStatusOutput,
} from 'utils/lib/types/api/referrals/referrals.types';
import { listReferrals, saveReferral, updateReferralStatus } from './referrals.api';

export const REFERRALS_QUERY_KEY = 'referrals';

export const useReferralsQuery = (
  input: ListReferralsInput | undefined
): UseQueryResult<ListReferralsOutput, Error> => {
  const { oystehrZambda } = useApiClients();
  return useQuery({
    queryKey: [REFERRALS_QUERY_KEY, input?.patientId, input?.encounterId],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      if (!input) throw new Error('Referral query input is not defined');
      return listReferrals(oystehrZambda, input);
    },
    enabled: !!oystehrZambda && !!input && (!!input.patientId || !!input.encounterId),
  });
};

export const useSaveReferralMutation = (): UseMutationResult<SaveReferralOutput, Error, SaveReferralInput> =>
  useInvalidatingZambdaMutation('save-referral', saveReferral, REFERRALS_QUERY_KEY);

export const useUpdateReferralStatusMutation = (): UseMutationResult<
  UpdateReferralStatusOutput,
  Error,
  UpdateReferralStatusInput
> => useInvalidatingZambdaMutation('update-referral-status', updateReferralStatus, REFERRALS_QUERY_KEY);
