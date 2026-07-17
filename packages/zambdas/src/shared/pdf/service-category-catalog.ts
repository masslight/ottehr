import Oystehr from '@oystehr/sdk';
import { HealthcareService } from 'fhir/r4b';
import { parseServiceCategoryAbbreviation, SERVICE_CATEGORY_SYSTEM, SERVICE_CATEGORY_TAG } from 'utils';
import { ServiceCategoryCatalogEntry } from './types';

/**
 * Fetch the FHIR-backed service-category catalog reduced to the minimal shape
 * the abbreviation resolver needs. PDF builders use it so non-system categories
 * (Massage, Wellness, …) resolve to their admin-defined / derived abbreviation
 * instead of nothing — the slot stamps non-system categories with code only and
 * no display, so the appointment alone can't yield a readable name.
 *
 * Returns [] on any failure: the abbreviation is cosmetic and must never block
 * PDF generation.
 */
export const fetchServiceCategoryCatalog = async (oystehr: Oystehr): Promise<ServiceCategoryCatalogEntry[]> => {
  try {
    const resources = (
      await oystehr.fhir.search<HealthcareService>({
        resourceType: 'HealthcareService',
        params: [{ name: '_tag', value: SERVICE_CATEGORY_TAG.code }],
      })
    ).unbundle();
    return resources.flatMap((r) => {
      const code =
        r.type?.[0]?.coding?.find((c) => c.system === SERVICE_CATEGORY_SYSTEM)?.code ?? r.type?.[0]?.coding?.[0]?.code;
      if (!code || !r.name) return [];
      return [{ code, name: r.name, abbreviation: parseServiceCategoryAbbreviation(r) }];
    });
  } catch (e) {
    console.error('Failed to fetch service-category catalog for PDF abbreviation:', e);
    return [];
  }
};
