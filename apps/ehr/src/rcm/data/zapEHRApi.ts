import Oystehr from '@oystehr/sdk';
import { ClaimsQueueGetRequest, ClaimsQueueGetResponse, getOystehrApiHelpers } from 'utils';
import { Get_Oystehr_RCM_API_Params } from './types';

enum ZambdaNames {
  'get claims' = 'get claims',
}

const zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean> = {
  'get claims': false,
};

export type Oystehr_RCM_APIClient = ReturnType<typeof getOystehr_RCM_API>;

export const getOystehr_RCM_API = (
  params: Get_Oystehr_RCM_API_Params,
  oystehr: Oystehr
): {
  getClaims: typeof getClaims;
} => {
  const { getClaimsZambdaID } = params;

  const zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined> = {
    'get claims': getClaimsZambdaID,
  };
  const isAppLocalProvided = params.isAppLocal != null;

  const { makeZapRequest } = getOystehrApiHelpers(
    oystehr,
    ZambdaNames,
    zambdasToIdsMap,
    zambdasPublicityMap,
    isAppLocalProvided
  );

  const getClaims = async (parameters: ClaimsQueueGetRequest): Promise<ClaimsQueueGetResponse> => {
    return await makeZapRequest('get claims', parameters);
  };

  return {
    getClaims,
  };
};
