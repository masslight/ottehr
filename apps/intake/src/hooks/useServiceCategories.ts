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
 * Returns the current service categories from the FHIR registry, falling back
 * to the compiled-in BOOKING_CONFIG.SERVICE_CATEGORIES_AVAILABLE when the
 * registry is empty or unreachable. The hook always returns *something* — it
 * never shows an empty list — so existing booking flows keep working.
 *
 * When a group context is passed, the returned list is intersected with the
 * group's declared categories (HealthcareService.type[]), so patients booking
 * via a group URL only see categories that group actually offers.
 */
export function useServiceCategories(context: ServiceCategoryContext = {}): {
  serviceCategories: ServiceCategoryConfig[];
  source: 'fhir' | 'booking-config' | 'fallback';
  isLoading: boolean;
} {
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const { scheduleType, bookingOn } = context;

  const { data, isLoading } = useQuery({
    queryKey: ['intake-service-categories', scheduleType ?? null, bookingOn ?? null],
    queryFn: async (): Promise<{
      serviceCategories: ServiceCategoryConfig[];
      source: 'fhir' | 'booking-config';
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
      return { serviceCategories: records.map(toConfig), source: parsed?.source ?? 'fhir' };
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
