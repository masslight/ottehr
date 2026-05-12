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
      const isScoped = Boolean(scheduleType && bookingOn);
      const response = await zambdaClient.executePublic(
        GET_SERVICE_CATEGORIES_ZAMBDA,
        isScoped ? { scheduleType, bookingOn } : {}
      );
      const parsed = typeof response.output === 'string' ? JSON.parse(response.output) : (response.output as any);
      const records = (parsed?.serviceCategories || []) as ServiceCategoryRuntimeRecord[];

      // Scoped query (group context): the zambda has already intersected the
      // catalog with the bookable entity's declared categories. Trust its
      // result verbatim — do NOT re-merge BOOKING_CONFIG, or system-level
      // categories (urgent-care, workers-comp, etc.) would leak back into a
      // group's picker even when the group hasn't allow-listed them.
      if (isScoped) {
        return { serviceCategories: records.map(toConfig), source: 'fhir' };
      }

      if (records.length === 0) {
        return { serviceCategories: BOOKING_CONFIG.serviceCategories, source: 'booking-config' };
      }
      // Unscoped (homepage, etc.): merge BOOKING_CONFIG (the production source
      // of truth for compiled-in categories that production URLs depend on)
      // with any new FHIR-registry categories. BOOKING_CONFIG wins on code
      // collisions so admins can only *add* categories, not silently override
      // compiled defaults.
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
  // No data yet (initial load). For scoped (group) queries fall back to an
  // empty list, not the compiled-in BOOKING_CONFIG — otherwise the picker
  // briefly flashes system-level categories (urgent-care, workers-comp, etc.)
  // before the group's allow-listed services arrive. For unscoped queries
  // (homepage, etc.) keep the BOOKING_CONFIG fallback so the page never
  // appears empty during loading.
  const isScoped = Boolean(scheduleType && bookingOn);
  return {
    serviceCategories: isScoped ? [] : BOOKING_CONFIG.serviceCategories,
    source: 'fallback',
    isLoading,
  };
}
