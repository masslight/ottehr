import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { generateLabelXml } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { OnDemandLabelXmlRequestInput, OnDemandLabelXmlRequestOutput } from 'utils';

export const useGetLabelXmlAndPrintingConfig = (): ((
  input: OnDemandLabelXmlRequestInput
) => Promise<OnDemandLabelXmlRequestOutput>) => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  return useCallback(
    async (input: OnDemandLabelXmlRequestInput): Promise<OnDemandLabelXmlRequestOutput> => {
      const queryKey = ['generate-label-xml'];
      if (input.type === 'visit') {
        queryKey.push(input.encounterId);
      } else {
        queryKey.push(input.serviceRequestId);
      }

      return queryClient.fetchQuery({
        queryKey,
        queryFn: () => generateLabelXml(oystehrZambda!, input),
        staleTime: 30_000,
      });
    },
    [oystehrZambda, queryClient]
  );
};
