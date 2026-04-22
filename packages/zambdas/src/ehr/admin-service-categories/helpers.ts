import Oystehr from '@oystehr/sdk';
import { CodeableConcept, HealthcareService } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, ZambdaInput } from '../../shared';

/** Tag identifying a HealthcareService as a bookable service category. */
export const SERVICE_CATEGORY_TAG = {
  system: 'https://fhir.ottehr.com/CodeSystem/healthcare-service-type',
  code: 'booking-service-category',
};

export const SERVICE_CATEGORY_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/service-category';

/** Structured config stored as JSON in an extension on the HealthcareService. */
export const SERVICE_CATEGORY_CONFIG_EXTENSION_URL =
  'https://fhir.ottehr.com/StructureDefinitions/service-category-config';

/**
 * Runtime-editable per-service-category settings. Mirrors the shape of the
 * compiled-in BOOKING_CONFIG.SERVICE_CATEGORIES_AVAILABLE entries, plus a
 * durationMinutes field so slot generation can vary by category.
 */
export interface ServiceCategoryRuntimeConfig {
  durationMinutes: number;
  serviceModes: Array<'in-person' | 'virtual'>;
  /** FHIR booking-flow visit types — 'prebook' vs 'walk-in', inherited from BOOKING_CONFIG shape. */
  visitTypes: Array<'prebook' | 'walk-in'>;
  reasonsForVisit?: Array<{ label: string; value: string }>;
}

export interface ServiceCategoryRecord {
  id?: string;
  name: string;
  code: string;
  active: boolean;
  config: ServiceCategoryRuntimeConfig;
}

let m2mToken: string;

export async function getClient(input: ZambdaInput): Promise<Oystehr> {
  if (!input.secrets) throw new Error('No secrets provided');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  return createOystehrClient(m2mToken, input.secrets);
}

export function parseConfig(resource: HealthcareService): ServiceCategoryRuntimeConfig {
  const ext = resource.extension?.find((e) => e.url === SERVICE_CATEGORY_CONFIG_EXTENSION_URL);
  const raw = ext?.valueString;
  if (!raw) {
    return { durationMinutes: 15, serviceModes: ['in-person'], visitTypes: ['prebook'] };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceCategoryRuntimeConfig>;
    return {
      durationMinutes: parsed.durationMinutes ?? 15,
      serviceModes: parsed.serviceModes ?? ['in-person'],
      visitTypes: parsed.visitTypes ?? ['prebook'],
      reasonsForVisit: parsed.reasonsForVisit,
    };
  } catch {
    return { durationMinutes: 15, serviceModes: ['in-person'], visitTypes: ['prebook'] };
  }
}

export function toRecord(resource: HealthcareService): ServiceCategoryRecord {
  const code =
    resource.type?.[0]?.coding?.find((c) => c.system === SERVICE_CATEGORY_SYSTEM)?.code ||
    resource.type?.[0]?.coding?.[0]?.code ||
    '';
  return {
    id: resource.id,
    name: resource.name || '(untitled)',
    code,
    active: resource.active !== false,
    config: parseConfig(resource),
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
  return {
    resourceType: 'HealthcareService',
    id: record.id,
    meta: { tag: [SERVICE_CATEGORY_TAG] },
    active: record.active,
    name: record.name,
    type,
    extension: [
      {
        url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
        valueString: JSON.stringify(record.config),
      },
    ],
  };
}
