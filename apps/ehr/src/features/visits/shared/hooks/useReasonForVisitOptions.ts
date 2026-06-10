import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { HealthcareService } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  BOOKING_CONFIG,
  getReasonForVisitOptionsForServiceCategory,
  parseReasonsForVisit,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
} from 'utils';

const QUERY_STALE_TIME = 5 * 60 * 1000;

type RfvOption = { value: string; label: string };

// Reason-for-visit options live in two places: BOOKING_CONFIG (compiled-in
// production categories like urgent-care) and per-HealthcareService
// extensions on admin-managed categories created via the Services admin UI.
// The patient-facing booking flow sees both because get-booking-questionnaire
// enriches the answer list at request time; the EHR's staff-side dropdown was
// reading only BOOKING_CONFIG and showed an empty Select for any admin-managed
// category. Mirror the BOOKING_CONFIG-first / FHIR-fallback pattern that
// update-visit-details' resolveCategory already uses so the two surfaces agree
// on what's valid.
export const useReasonForVisitOptions = (serviceCategoryCode: string | undefined): RfvOption[] => {
  const { oystehr } = useApiClients();

  const inBookingConfig = serviceCategoryCode
    ? BOOKING_CONFIG.serviceCategories.some((sc) => sc.category.code === serviceCategoryCode)
    : false;

  // One query fetches every active category-tagged HealthcareService; the
  // result is cached and reused across mounts. A code-keyed query would be
  // simpler but would burn one round-trip per appointment opened.
  const { data: fhirCategoryHits } = useQuery({
    queryKey: ['booking-service-category-list'],
    queryFn: async (): Promise<HealthcareService[]> => {
      if (!oystehr) return [];
      const result = await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [
          { name: '_tag', value: SERVICE_CATEGORY_TAG.code },
          { name: 'active', value: 'true' },
        ],
      });
      return result.unbundle();
    },
    enabled: !!oystehr && !inBookingConfig && !!serviceCategoryCode,
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });

  if (!serviceCategoryCode) return [];
  if (inBookingConfig) {
    return getReasonForVisitOptionsForServiceCategory(serviceCategoryCode);
  }
  const fhirMatch = (fhirCategoryHits ?? []).find((hs) =>
    (hs.type ?? []).some((concept) =>
      (concept.coding ?? []).some((c) => c.system === SERVICE_CATEGORY_SYSTEM && c.code === serviceCategoryCode)
    )
  );
  return fhirMatch ? parseReasonsForVisit(fhirMatch) : [];
};
