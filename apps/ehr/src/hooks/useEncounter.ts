import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { Encounter } from 'fhir/r4b';
import { DocumentReference } from 'fhir/r4b';
import { RECEIPT_CODE } from 'utils';
import { useApiClients } from './useAppClients';

export interface useGetEncounterInput {
  encounterId?: string;
}

export const useGetEncounter = (input: useGetEncounterInput): UseQueryResult<Encounter, Error> => {
  const { oystehr } = useApiClients();
  const { encounterId } = input;

  return useQuery({
    queryKey: [`encounter`, input.encounterId],

    queryFn: async (): Promise<Encounter> => {
      if (oystehr) {
        return await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId ?? '' });
      }

      throw new Error('api client not defined or patient id is not provided');
    },

    enabled: Boolean(encounterId) && Boolean(oystehr),
  });
};

export const useEncounterReceipt = (input: useGetEncounterInput): UseQueryResult<DocumentReference | null, Error> => {
  const { oystehr } = useApiClients();
  const { encounterId } = input;

  return useQuery({
    queryKey: ['encounter-receipt', encounterId],
    queryFn: async () => {
      if (oystehr) {
        const response = await oystehr!.fhir.search<DocumentReference>({
          resourceType: 'DocumentReference',
          params: [
            { name: 'type', value: RECEIPT_CODE },
            { name: 'encounter', value: `Encounter/${encounterId}` },
          ],
        });

        const receipt = response.unbundle()[0] ?? null;

        return receipt;
      }

      throw new Error('api client not defined or patient id is not provided');
    },
    enabled: Boolean(encounterId) && Boolean(oystehr),
  });
};
