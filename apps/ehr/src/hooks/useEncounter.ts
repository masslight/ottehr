import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { Encounter } from 'fhir/r4b';
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
