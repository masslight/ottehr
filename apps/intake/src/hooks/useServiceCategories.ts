import { useQuery } from '@tanstack/react-query';
import type { ServiceCategoryConfig } from 'config-types';
import { Coding } from 'fhir/r4b';
import { BOOKING_CONFIG, SERVICE_CATEGORY_SYSTEM } from 'utils';
import { useUCZambdaClient } from './useUCZambdaClient';

const GET_SERVICE_CATEGORIES_ZAMBDA = 'get-service-categories';

interface ServiceCategoryRuntimeRecord {
  id?: string;
  name: string;
  code: string;
  active: boolean;
  config: {
    durationMinutes: number;
    serviceModes: Array<'in-person' | 'virtual'>;
    visitTypes: Array<'prebook' | 'walk-in'>;
    reasonsForVisit?: Array<{ label: string; value: string }>;
  };
}

/** Convert a FHIR-backed runtime record to the shape existing code expects. */
function toConfig(record: ServiceCategoryRuntimeRecord): ServiceCategoryConfig {
  const coding: Coding = {
    system: SERVICE_CATEGORY_SYSTEM,
    code: record.code,
    display: record.name,
  };
  return {
    category: coding as ServiceCategoryConfig['category'],
    serviceModes: record.config.serviceModes,
    visitTypes: record.config.visitTypes,
    reasonsForVisit: {
      default: record.config.reasonsForVisit || [],
    },
  };
}

export interface ServiceCategoryContext {
  /** 'group' | 'location' | 'provider' — when set, the zambda scopes the returned list. */
  scheduleType?: string;
  /** Slug of the bookable entity. Used with scheduleType=group to intersect with the group's offered categories. */
  bookingOn?: string;
}

/**
 * Returns the active service categories: the compiled-in BOOKING_CONFIG entries
 * (production source of truth, in-flight when this branch was started) merged
 * with any FHIR-registry entries the admin has added through the new Services
 * admin UI. **BOOKING_CONFIG wins on code collisions** — a FHIR entry with the
 * same code as an existing BOOKING_CONFIG entry is ignored. This keeps
 * production URLs (e.g. `?serviceCategoryCode=urgent-care`) and intake homepage
 * routing structurally identical to pre-branch behavior; the FHIR registry can
 * only *add* new categories, not silently override the compiled defaults.
 *
 * If the registry is unreachable or returns an empty list, the result is just
 * BOOKING_CONFIG.serviceCategories — the pre-branch shape.
 *
 * When a group context is passed, the returned list is intersected with the
 * group's declared categories (HealthcareService.type[]), so patients booking
 * via a group URL only see categories that group actually offers.
 */
export function useServiceCategories(context: ServiceCategoryContext = {}): {
  serviceCategories: ServiceCategoryConfig[];
  source: 'fhir' | 'booking-config' | 'merged' | 'fallback';
  isLoading: boolean;
} {
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const { scheduleType, bookingOn } = context;

  const { data, isLoading } = useQuery({
    queryKey: ['intake-service-categories', scheduleType ?? null, bookingOn ?? null],
    queryFn: async (): Promise<{
      serviceCategories: ServiceCategoryConfig[];
      source: 'fhir' | 'booking-config' | 'merged';
    }> => {
      if (!zambdaClient) {
        return { serviceCategories: BOOKING_CONFIG.serviceCategories, source: 'booking-config' };
      }
      const response = await zambdaClient.executePublic(
        GET_SERVICE_CATEGORIES_ZAMBDA,
        scheduleType && bookingOn ? { scheduleType, bookingOn } : {}
      );
      const parsed = typeof response.output === 'string' ? JSON.parse(response.output) : (response.output as any);
      const records = (parsed?.serviceCategories || []) as ServiceCategoryRuntimeRecord[];
      if (records.length === 0) {
        return { serviceCategories: BOOKING_CONFIG.serviceCategories, source: 'booking-config' };
      }
      // Merge: BOOKING_CONFIG entries are the production source of truth and
      // win on code collisions. Only FHIR entries with codes NOT already in
      // BOOKING_CONFIG are added to the list. This makes the FHIR registry
      // strictly additive — admins can introduce new categories but cannot
      // silently override compiled defaults that production URLs depend on.
      const bookingCodes = new Set(
        BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code).filter((c): c is string => !!c)
      );
      const fhirOnly = records.map(toConfig).filter((sc) => sc.category.code && !bookingCodes.has(sc.category.code));
      return {
        serviceCategories: [...BOOKING_CONFIG.serviceCategories, ...fhirOnly],
        source: fhirOnly.length > 0 ? 'merged' : 'booking-config',
      };
    },
    enabled: !!zambdaClient,
    staleTime: 5 * 60 * 1000,
  });

  if (data) return { ...data, isLoading };
  return {
    serviceCategories: BOOKING_CONFIG.serviceCategories,
    source: 'fallback',
    isLoading,
  };
}
