import { HealthcareService } from 'fhir/r4b';
import { SERVICE_CATEGORIES_AVAILABLE } from 'utils';
import {
  SERVICE_CATEGORY_SYSTEM,
  ServiceCategoryRecord,
  toRecord,
} from '../../../ehr/admin-service-categories/helpers';

/**
 * Merge the compiled-in BOOKING_CONFIG catalog with the FHIR-registry records.
 *
 * Per design-doc D14, BOOKING_CONFIG is the source of truth for compiled-in
 * codes that production URLs depend on. FHIR-registry records are appended
 * only when their code isn't already in BOOKING_CONFIG — admins can ADD new
 * categories via the Services admin but cannot silently override compiled
 * defaults.
 *
 * Each returned record is tagged with its source ('booking-config' or
 * 'fhir') so callers can distinguish admin-managed entries from compiled-in
 * ones.
 */
export function buildCatalog(fhirResources: HealthcareService[]): ServiceCategoryRecord[] {
  const bookingConfigRecords: ServiceCategoryRecord[] = SERVICE_CATEGORIES_AVAILABLE.map((sc) => ({
    name: sc.category.display || sc.category.code || '',
    code: sc.category.code || '',
    active: true,
    config: {
      durationMinutes: 15,
      serviceModes: sc.serviceModes as Array<'in-person' | 'virtual'>,
      visitTypes: sc.visitTypes as Array<'prebook' | 'walk-in'>,
      reasonsForVisit: sc.reasonsForVisit?.default,
    },
    source: 'booking-config',
  }));
  const bookingCodes = new Set(bookingConfigRecords.map((r) => r.code).filter(Boolean));
  // toRecord (admin-service-categories/helpers) tags each record with source: 'fhir'.
  const fhirOnlyRecords = fhirResources.map(toRecord).filter((r) => r.code && !bookingCodes.has(r.code));
  return [...bookingConfigRecords, ...fhirOnlyRecords];
}

/**
 * Extract the service-category codes a group declares via its type[] field.
 * Only codings whose system matches SERVICE_CATEGORY_SYSTEM are included;
 * codings under any other system are ignored.
 */
export function getGroupOfferedCodes(group: HealthcareService): Set<string> {
  const codes = new Set<string>();
  for (const concept of group.type || []) {
    for (const coding of concept.coding || []) {
      if (coding.system === SERVICE_CATEGORY_SYSTEM && coding.code) {
        codes.add(coding.code);
      }
    }
  }
  return codes;
}

/**
 * Filter the catalog to entries whose code is in offeredCodes. When
 * offeredCodes is empty (the group hasn't configured a type[] yet), the
 * full catalog is returned — an intentional admin grace period so admins
 * who haven't curated their group's categories yet don't see a blank
 * picker.
 */
export function filterByOfferedCodes(
  catalog: ServiceCategoryRecord[],
  offeredCodes: Set<string>
): ServiceCategoryRecord[] {
  if (offeredCodes.size === 0) return catalog;
  return catalog.filter((sc) => offeredCodes.has(sc.code));
}
