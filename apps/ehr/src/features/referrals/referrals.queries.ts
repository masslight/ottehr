import { useMutation, UseMutationResult, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  ListReferralsInput,
  ListReferralsOutput,
  SaveReferralInput,
  SaveReferralOutput,
  UpdateReferralStatusInput,
  UpdateReferralStatusOutput,
} from 'utils/lib/types/api/referrals/referrals.types';
import { getReferralPdf, listReferrals, saveReferral, updateReferralStatus } from './referrals.api';

export const REFERRALS_QUERY_KEY = 'referrals';

/** Referrals for a patient (`{ patientId }`) or one visit (`{ encounterId }`), open ones first. */
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

const useReferralMutation = <Input, Output>(
  key: string,
  request: (oystehr: NonNullable<ReturnType<typeof useApiClients>['oystehrZambda']>, data: Input) => Promise<Output>
): UseMutationResult<Output, Error, Input> => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [key],
    mutationFn: async (data: Input) => {
      if (!oystehrZambda) throw new Error('OystehrZambda is not defined');
      return request(oystehrZambda, data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [REFERRALS_QUERY_KEY] }),
  });
};

export const useSaveReferralMutation = (): UseMutationResult<SaveReferralOutput, Error, SaveReferralInput> =>
  useReferralMutation('save-referral', saveReferral);

export const useUpdateReferralStatusMutation = (): UseMutationResult<
  UpdateReferralStatusOutput,
  Error,
  UpdateReferralStatusInput
> => useReferralMutation('update-referral-status', updateReferralStatus);

/** Opens the referral form PDF in a new tab, the way generateAndOpenRadiologyOrderForm does. */
export const openReferralPdf = async (
  oystehr: NonNullable<ReturnType<typeof useApiClients>['oystehrZambda']>,
  referralId: string
): Promise<void> => {
  const { presignedURL } = await getReferralPdf(oystehr, { referralId });
  try {
    const blob = await (await fetch(presignedURL)).blob();
    window.open(URL.createObjectURL(blob), '_blank');
  } catch {
    window.open(presignedURL, '_blank');
  }
};
