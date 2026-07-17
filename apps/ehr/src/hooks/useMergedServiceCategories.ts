import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { BOOKING_CONFIG } from 'utils';
import { listServiceCategories } from '../api/api';
import { useApiClients } from './useAppClients';

export interface MergedServiceCategoryOption {
  code: string;
  display: string;
}

/**
 * Returns the full set of bookable service categories for filter dropdowns:
 * the compiled-in BOOKING_CONFIG ("system") categories plus the active,
 * admin-defined categories from the FHIR-backed catalog (Admin → Services).
 *
 * Inactive admin categories are excluded so deactivated services stop showing
 * up as filter options. The query shares the ['service-categories'] cache key
 * with the Services admin page and abbreviation resolver so the catalog is
 * fetched once across the app.
 */
export const useMergedServiceCategories = (): MergedServiceCategoryOption[] => {
  const { oystehrZambda } = useApiClients();

  const { data } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] };
      try {
        return await listServiceCategories(oystehrZambda);
      } catch {
        return { serviceCategories: [] };
      }
    },
    enabled: !!oystehrZambda,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const fhirRecords = data?.serviceCategories ?? [];
    const bookingCodes = new Set(
      BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code).filter((c): c is string => !!c)
    );
    const fhirOnly = fhirRecords
      .filter((r) => r.active !== false && r.code && !bookingCodes.has(r.code))
      .map((r) => ({ code: r.code, display: r.name }));
    const bookingEntries = BOOKING_CONFIG.serviceCategories.map((sc) => ({
      code: sc.category.code as string,
      display: sc.category.display ?? sc.category.code ?? '',
    }));
    return [...bookingEntries, ...fhirOnly].sort((a, b) => a.display.localeCompare(b.display));
  }, [data?.serviceCategories]);
};
