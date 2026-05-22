import Oystehr from '@oystehr/sdk';
import { CodeableConcept, HealthcareService } from 'fhir/r4b';
import {
  getServiceCategoryCadenceMinutes,
  getServiceCategoryDurationMinutes,
  getServiceCategoryModes,
  getServiceCategoryVisitTypes,
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../shared';

/**
 * Runtime-editable per-service-category settings. Mirrors the shape of the
 * compiled-in BOOKING_CONFIG.SERVICE_CATEGORIES_AVAILABLE entries, plus a
 * durationMinutes field so slot generation can vary by category.
 *
 * On the FHIR side:
 * - durationMinutes, cadenceMinutes, serviceModes, visitTypes live on
 *   HealthcareService.characteristic[] (queryable).
 * - reasonsForVisit currently lives in a JSON-blob extension; see
 *   design-debt-log.md D-1 for the planned move to a contained ValueSet.
 */
export interface ServiceCategoryRuntimeConfig {
  durationMinutes: number;
  /**
   * Interval between offered slot start times, in minutes. Independent of
   * durationMinutes — a 60-minute service may be offered every 30 min if
   * cadenceMinutes is 30. When omitted, the slot generator falls back to a
   * sensible default (typically 15).
   */
  cadenceMinutes?: number;
  serviceModes: ServiceMode[];
  /** Booking-flow capabilities — 'prebook' vs 'walk-in'. */
  visitTypes: ServiceVisitType[];
  reasonsForVisit?: Array<{ label: string; value: string }>;
}

export interface ServiceCategoryRecord {
  id?: string;
  name: string;
  code: string;
  active: boolean;
  config: ServiceCategoryRuntimeConfig;
  /**
   * Origin of this record in the resolved catalog. Set by the public
   * `get-service-categories` zambda when assembling the catalog for the
   * booking flow. Admin CRUD paths can leave this undefined.
   */
  source?: 'booking-config' | 'fhir';
}

let m2mToken: string;

export async function getClient(input: ZambdaInput): Promise<Oystehr> {
  if (!input.secrets) throw new Error('No secrets provided');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  return createOystehrClient(m2mToken, input.secrets);
}

/**
 * Parse the JSON-blob extension that still holds the free-form
 * reasonsForVisit field. Returns an empty array if absent or unparseable.
 * The queryable runtime fields (mode/visit-type/duration/cadence) come
 * from characteristic[] now and are read separately in `toRecord`.
 */
function parseReasonsForVisit(resource: HealthcareService): Array<{ label: string; value: string }> {
  const ext = resource.extension?.find((e) => e.url === SERVICE_CATEGORY_CONFIG_EXTENSION_URL);
  const raw = ext?.valueString;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { reasonsForVisit?: Array<{ label: string; value: string }> };
    return parsed.reasonsForVisit ?? [];
  } catch {
    return [];
  }
}

export function toRecord(resource: HealthcareService): ServiceCategoryRecord {
  const code =
    resource.type?.[0]?.coding?.find((c) => c.system === SERVICE_CATEGORY_SYSTEM)?.code ||
    resource.type?.[0]?.coding?.[0]?.code ||
    '';
  const modes = getServiceCategoryModes(resource);
  const visitTypes = getServiceCategoryVisitTypes(resource);
  return {
    id: resource.id,
    name: resource.name || '(untitled)',
    code,
    active: resource.active !== false,
    config: {
      durationMinutes: getServiceCategoryDurationMinutes(resource) ?? 15,
      cadenceMinutes: getServiceCategoryCadenceMinutes(resource),
      serviceModes: modes.length > 0 ? modes : [ServiceMode['in-person']],
      visitTypes: visitTypes.length > 0 ? visitTypes : [ServiceVisitType.prebook],
      reasonsForVisit: parseReasonsForVisit(resource),
    },
    source: 'fhir',
  };
}

export function toFhirResource(record: ServiceCategoryRecord): HealthcareService {
  const type: CodeableConcept[] = [
    {
      coding: [
        {
          system: SERVICE_CATEGORY_SYSTEM,
          code: record.code,
          display: record.name,
        },
      ],
      text: record.name,
    },
  ];
  const ownedCharacteristics = serviceCategoryCharacteristics({
    modes: record.config.serviceModes,
    visitTypes: record.config.visitTypes,
    durationMinutes: record.config.durationMinutes,
    cadenceMinutes: record.config.cadenceMinutes,
  });
  // toFhirResource is called from both create and update paths; there's no
  // existing resource to merge against here. Update-path callers that need
  // to preserve foreign characteristics should use mergeOwnedCharacteristics
  // with SERVICE_CATEGORY_OWNED_CHARACTERISTIC_SYSTEMS before persisting.
  const reasons = record.config.reasonsForVisit ?? [];
  return {
    resourceType: 'HealthcareService',
    id: record.id,
    meta: { tag: [SERVICE_CATEGORY_TAG] },
    active: record.active,
    name: record.name,
    type,
    characteristic: ownedCharacteristics,
    // Free-form fields still live in the JSON-blob extension; see
    // design-debt-log.md D-1.
    extension:
      reasons.length > 0
        ? [
            {
              url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
              valueString: JSON.stringify({ reasonsForVisit: reasons }),
            },
          ]
        : undefined,
  };
}
