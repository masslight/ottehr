import Oystehr from '@oystehr/sdk';
import { HealthcareService } from 'fhir/r4b';
import { getReasonForVisitOptionsForServiceCategory } from '../config-helpers/booking';
import { BOOKING_CONFIG } from '../ottehr-config/booking';
import { SERVICE_CATEGORY_SYSTEM, SERVICE_CATEGORY_TAG } from './constants';
import { getAllFhirSearchPages } from './getAllFhirSearchPages';
import {
  getServiceCategoryCadenceMinutes,
  getServiceCategoryDurationMinutes,
  parseReasonsForVisit,
} from './healthcareService';

export interface ResolvedServiceCategory {
  code: string;
  /** BOOKING_CONFIG.category.display or HealthcareService.name. */
  display: string | undefined;
  /**
   * Slot duration in minutes. Undefined for BOOKING_CONFIG entries — those
   * fall through to per-Schedule slot length (the pre-FHIR-catalog behavior).
   * Undefined for FHIR entries that simply don't configure one.
   */
  durationMinutes: number | undefined;
  /**
   * Cadence between offered slot starts. Same undefined-semantic as
   * durationMinutes. Critical for non-divisor cadences (e.g., a 30-min slot
   * on a 15-min cadence) — readers that skip the cadence will regenerate the
   * grid at a coarser default and silently reject otherwise-valid slot
   * starts.
   */
  cadenceMinutes: number | undefined;
  /** Configured RFV options; empty array when none. */
  reasonsForVisit: Array<{ value: string; label: string }>;
  source: 'booking-config' | 'fhir';
}

/**
 * Single resolver for service-category metadata, consumed by every surface
 * that needs to know "what does category X mean?" — booking flow (slot
 * vending), visit-details validation, RFV dropdowns.
 *
 * Resolution order is BOOKING_CONFIG-first → FHIR-fallback. BOOKING_CONFIG is
 * the compiled-in source of truth for production-deployed categories
 * (urgent-care, workers-comp, etc.); a FHIR entry with the same code is
 * intentionally ignored so an admin who creates a colliding FHIR row can't
 * silently change the slot-generation behavior of an existing production
 * booking URL. The FHIR catalog is consulted only for codes that are NOT in
 * BOOKING_CONFIG (i.e., genuinely new admin-added categories).
 *
 * Pass `fhirCategoryHits` when the caller has already fetched the full
 * category-tagged HS list — saves a round-trip. Otherwise the helper
 * paginates the catalog itself (>1-page catalogs would otherwise miss
 * categories on later pages).
 */
export async function resolveServiceCategory(
  code: string,
  oystehr: Oystehr,
  options: { fhirCategoryHits?: HealthcareService[] } = {}
): Promise<ResolvedServiceCategory | undefined> {
  const bookingConfigMatch = BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === code);
  if (bookingConfigMatch) {
    return {
      code,
      display: bookingConfigMatch.category.display,
      durationMinutes: undefined,
      cadenceMinutes: undefined,
      reasonsForVisit: getReasonForVisitOptionsForServiceCategory(code),
      source: 'booking-config',
    };
  }

  const fhirCategoryHits =
    options.fhirCategoryHits ??
    (await getAllFhirSearchPages<HealthcareService>(
      {
        resourceType: 'HealthcareService',
        params: [
          { name: '_tag', value: SERVICE_CATEGORY_TAG.code },
          { name: 'active', value: 'true' },
        ],
      },
      oystehr
    ));

  const fhirMatch = fhirCategoryHits.find((hs) =>
    (hs.type ?? []).some((concept) =>
      (concept.coding ?? []).some((c) => c.system === SERVICE_CATEGORY_SYSTEM && c.code === code)
    )
  );
  if (!fhirMatch) return undefined;

  return {
    code,
    display: fhirMatch.name,
    durationMinutes: getServiceCategoryDurationMinutes(fhirMatch),
    cadenceMinutes: getServiceCategoryCadenceMinutes(fhirMatch),
    reasonsForVisit: parseReasonsForVisit(fhirMatch),
    source: 'fhir',
  };
}
