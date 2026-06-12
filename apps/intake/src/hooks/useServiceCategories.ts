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
  source?: 'booking-config' | 'fhir';
}

/** Page-facing config shape with the per-entry source label preserved. */
export type ServiceCategoryConfigWithSource = ServiceCategoryConfig & {
  source?: 'booking-config' | 'fhir';
};

/** Convert a runtime record to the page-facing config shape, preserving source. */
function toConfig(record: ServiceCategoryRuntimeRecord): ServiceCategoryConfigWithSource {
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
    source: record.source,
  };
}

/** Tag compiled-in BOOKING_CONFIG entries with source so fallback data is shape-compatible. */
function tagBookingConfig(entries: ServiceCategoryConfig[]): ServiceCategoryConfigWithSource[] {
  return entries.map((sc) => ({ ...sc, source: 'booking-config' as const }));
}

export interface ServiceCategoryContext {
  /** 'group' | 'location' | 'provider' — when set, the zambda scopes the returned list. */
  scheduleType?: string;
  /** Slug of the bookable entity. Used with scheduleType=group to intersect with the group's offered categories. */
  bookingOn?: string;
}

/**
 * Returns the active service categories for the booking flow.
 *
 * All resolution logic — merging the compiled-in BOOKING_CONFIG with the
 * FHIR-registry catalog, and scoping to a group's declared categories —
 * lives in the `get-service-categories` zambda. This hook is a thin
 * adapter: it calls the zambda, converts records to the page-facing shape,
 * and handles loading-state fallback.
 *
 * Each returned category carries a `source` of 'booking-config' or 'fhir'
 * so callers can distinguish admin-managed entries from compiled-in ones.
 */
export function useServiceCategories(context: ServiceCategoryContext = {}): {
  serviceCategories: ServiceCategoryConfigWithSource[];
  isLoading: boolean;
} {
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const { scheduleType, bookingOn } = context;

  const { data, isLoading } = useQuery({
    queryKey: ['intake-service-categories', scheduleType ?? null, bookingOn ?? null],
    queryFn: async (): Promise<ServiceCategoryConfigWithSource[]> => {
      if (!zambdaClient) {
        return tagBookingConfig(BOOKING_CONFIG.serviceCategories);
      }
      const isScoped = Boolean(scheduleType && bookingOn);
      const response = await zambdaClient.executePublic(
        GET_SERVICE_CATEGORIES_ZAMBDA,
        isScoped ? { scheduleType, bookingOn } : {}
      );
      const parsed = typeof response.output === 'string' ? JSON.parse(response.output) : (response.output as any);
      const records = (parsed?.serviceCategories || []) as ServiceCategoryRuntimeRecord[];
      return records.map(toConfig);
    },
    enabled: !!zambdaClient,
    staleTime: 5 * 60 * 1000,
  });

  if (data) return { serviceCategories: data, isLoading };
  // No data yet (initial load). For scoped (group) queries fall back to an
  // empty list, not the compiled-in BOOKING_CONFIG — otherwise the picker
  // briefly flashes system-level categories (urgent-care, workers-comp, etc.)
  // before the group's allow-listed services arrive. For unscoped queries
  // (homepage, etc.) keep the BOOKING_CONFIG fallback so the page never
  // appears empty during loading.
  const isScoped = Boolean(scheduleType && bookingOn);
  return {
    serviceCategories: isScoped ? [] : tagBookingConfig(BOOKING_CONFIG.serviceCategories),
    isLoading,
  };
}
