import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { resolveServiceCategoryAbbreviation } from 'utils';
import { listServiceCategories } from '../api/api';
import { useApiClients } from './useAppClients';

/**
 * Returns a resolver that maps a service-category code or display name to its
 * short abbreviation, preferring the admin-defined "Abbreviation/Short Name"
 * from the FHIR-backed catalog and falling back to a derived one.
 *
 * The catalog is loaded once via React Query (shared cache key with the
 * Services admin page) so the many Tracking Board rows that call this hook
 * trigger a single fetch.
 */
export const useServiceCategoryAbbreviationResolver = (): ((codeOrName?: string) => string | undefined) => {
  const { oystehrZambda } = useApiClients();

  const { data } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] };
      return await listServiceCategories(oystehrZambda);
    },
    enabled: !!oystehrZambda,
    staleTime: 5 * 60 * 1000,
  });

  const categories = data?.serviceCategories;

  return useCallback((codeOrName?: string) => resolveServiceCategoryAbbreviation(codeOrName, categories), [categories]);
};
