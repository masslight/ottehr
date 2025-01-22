import Oystehr from '@oystehr/sdk';
import { ClaimsQueueGetRequest, ClaimsQueueGetResponse, getZapEHRApiHelpers } from 'utils';
import { GetZapEHR_RCM_APIParams } from './types';

enum ZambdaNames {
  'get claims' = 'get claims',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'get claims': false,
};

export type ZapEHR_RCM_APIClient = ReturnType<typeof getZapEHR_RCM_API>;

export const getZapEHR_RCM_API = (
  params: GetZapEHR_RCM_APIParams,
  oystehr: Oystehr
): {
  getClaims: typeof getClaims;
} => {
  const { getClaimsZambdaID } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'get claims': getClaimsZambdaID,
  };
  const isAppLocalProvided = params.isAppLocal != null;
  const isAppLocal = params.isAppLocal === 'true';

  const { makeZapRequest } = getZapEHRApiHelpers(
    oystehr,
    ZambdaNames,
    zambdasToIdsMap,
    zambdasPublicityMap,
    isAppLocalProvided,
    isAppLocal
  );

  const getClaims = async (parameters: ClaimsQueueGetRequest): Promise<ClaimsQueueGetResponse> => {
    return await makeZapRequest('get claims', parameters);
  };

  return {
    getClaims,
  };
};
