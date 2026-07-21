import Oystehr from '@oystehr/sdk';
import { CodeableConcept, HealthcareService } from 'fhir/r4b';
import {
  DEFAULT_SERVICE_CATEGORY_DURATION_MINUTES,
  getServiceCategoryCadenceMinutes,
  getServiceCategoryDurationMinutes,
  getServiceCategoryModes,
  getServiceCategoryVisitTypes,
  parsePaperworkFlowGroup,
  parseReasonsForVisit,
  parseServiceCategoryAbbreviation,
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, ZambdaInput } from '../../shared';

/**
 * Runtime-editable per-service-category settings. Mirrors the shape of the
 * compiled-in BOOKING_CONFIG.SERVICE_CATEGORIES_AVAILABLE entries, plus a
 * durationMinutes field so slot generation can vary by category.
 *
 * On the FHIR side:
 * - durationMinutes, cadenceMinutes, serviceModes, visitTypes live on
 *   HealthcareService.characteristic[] (queryable).
 * - reasonsForVisit currently lives in a JSON-blob extension at
 *   SERVICE_CATEGORY_CONFIG_EXTENSION_URL.
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

export interface ServiceCategory {
  id?: string;
  name: string;
  code: string;
  /**
   * Short abbreviation (2-3 chars) shown on the Tracking Board and patient
   * visit lists — e.g. 'UC', 'WC'. Stored in the JSON-blob config extension.
   */
  abbreviation?: string;
  /**
   * Paperwork-flow group slug (OTR-2309) this service is assigned to, if any. Single-valued.
   * Round-tripped here so an admin edit through this path never clobbers a flow assignment.
   */
  paperworkFlowGroup?: string;
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
  return createClinicalOystehrClient(m2mToken, input.secrets);
}

/**
 * Look up an existing service-category HealthcareService by its `code`. Used
 * by the create/update validators to enforce code uniqueness — a duplicate
 * code in the FHIR catalog would let two records claim the same service-
 * routing key, with which one wins at lookup time being arbitrary.
 *
 * Mirrors the `_tag` filter used by `admin-list-service-categories` (cheap
 * query, single-digit-count catalogs in practice) then filters in code. The
 * `type[].coding[]` match is `system|code` so a non-SERVICE_CATEGORY_SYSTEM
 * coding that happens to share the code string can't false-positive.
 */
export async function findServiceCategoryByCode(
  oystehr: Oystehr,
  code: string
): Promise<HealthcareService | undefined> {
  const results = (
    await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [{ name: '_tag', value: SERVICE_CATEGORY_TAG.code }],
    })
  ).unbundle();
  return results.find(
    (hs) => hs.type?.[0]?.coding?.some((c) => c.system === SERVICE_CATEGORY_SYSTEM && c.code === code)
  );
}

export function toRecord(resource: HealthcareService): ServiceCategory {
  // code is the discriminator for service-category HealthcareServices; the
  // admin UI keys off it and slot routing depends on it. A tagged-but-codeless
  // record is data corruption — fail loudly instead of returning a phantom
  // entry with code:''.
  const code =
    resource.type?.[0]?.coding?.find((c) => c.system === SERVICE_CATEGORY_SYSTEM)?.code ||
    resource.type?.[0]?.coding?.[0]?.code;
  if (!code) {
    // Unknown-shape error → unwrapped Error so wrapHandler's topLevelCatch
    // routes it through observability as a 500.
    throw new Error(
      `HealthcareService ${resource.id} is tagged as a service category but carries no code in type[].coding[].`
    );
  }
  // Name is admin-visible and used as the patient-facing label; a missing
  // value indicates a corrupt record, not a sensible default.
  if (!resource.name) {
    throw new Error(`HealthcareService ${resource.id} is tagged as a service category but has no name.`);
  }
  const modes = getServiceCategoryModes(resource);
  const visitTypes = getServiceCategoryVisitTypes(resource);
  return {
    id: resource.id,
    name: resource.name,
    code,
    abbreviation: parseServiceCategoryAbbreviation(resource),
    paperworkFlowGroup: parsePaperworkFlowGroup(resource),
    active: resource.active !== false,
    config: {
      durationMinutes: getServiceCategoryDurationMinutes(resource) ?? DEFAULT_SERVICE_CATEGORY_DURATION_MINUTES,
      cadenceMinutes: getServiceCategoryCadenceMinutes(resource),
      serviceModes: modes.length > 0 ? modes : [ServiceMode['in-person']],
      visitTypes: visitTypes.length > 0 ? visitTypes : [ServiceVisitType.prebook],
      reasonsForVisit: parseReasonsForVisit(resource),
    },
    source: 'fhir',
  };
}

export function toFhirResource(record: ServiceCategory): HealthcareService {
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
  const abbreviation = record.abbreviation?.trim();
  // Free-form fields share a single JSON-blob extension. Only include keys
  // that carry a value so the extension stays absent when nothing is set.
  const configBlob: { reasonsForVisit?: typeof reasons; abbreviation?: string; paperworkFlowGroup?: string } = {};
  if (reasons.length > 0) configBlob.reasonsForVisit = reasons;
  if (abbreviation) configBlob.abbreviation = abbreviation;
  if (record.paperworkFlowGroup) configBlob.paperworkFlowGroup = record.paperworkFlowGroup;
  return {
    resourceType: 'HealthcareService',
    id: record.id,
    meta: { tag: [SERVICE_CATEGORY_TAG] },
    active: record.active,
    name: record.name,
    type,
    characteristic: ownedCharacteristics,
    extension:
      Object.keys(configBlob).length > 0
        ? [
            {
              url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
              valueString: JSON.stringify(configBlob),
            },
          ]
        : undefined,
  };
}
