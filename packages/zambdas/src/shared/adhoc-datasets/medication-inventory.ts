import Oystehr from '@oystehr/sdk';
import {
  Encounter,
  FhirResource,
  Location,
  MedicationAdministration,
  Observation,
  Patient,
  Practitioner,
} from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM,
  INVENTORY_STOCK_ENTRY_CODE,
  parseInventoryLot,
  parseInventoryStockEntry,
} from 'utils/lib/fhir/medication-inventory';
import {
  AdHocMedicationInventoryInput,
  AdHocMedicationInventoryRow,
} from 'utils/lib/types/adhoc/datasets/medication-inventory';
import { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { presentFullName } from '../adhoc-report';

const round2 = (n: number): number => Math.round(n * 100) / 100;

// The ledger is scoped by category and date (never read whole): one Observation per stock change, with
// the lot (subject), clinic (focus), performer and, for administrations, the MedicationAdministration
// and through it the visit and patient. See documents/otr-3339-fhir-inventory-modeling.md, "Key queries".
export function medicationInventorySearchParams(dateRange: DateRange): { name: string; value: string }[] {
  return [
    { name: 'category', value: `${INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM}|${INVENTORY_STOCK_ENTRY_CODE}` },
    { name: 'date', value: `ge${dateRange.start}` },
    { name: 'date', value: `le${dateRange.end}` },
    { name: '_include', value: 'Observation:subject' },
    { name: '_include', value: 'Observation:focus' },
    { name: '_include', value: 'Observation:performer' },
    { name: '_include', value: 'Observation:part-of' },
    { name: '_include:iterate', value: 'MedicationAdministration:context' },
    { name: '_include:iterate', value: 'MedicationAdministration:subject' },
    { name: '_sort', value: 'date' },
  ];
}

/** One row per stock entry among `resources` (entries plus their included lots, clinics, performers, visits). */
export function buildMedicationInventoryRows(resources: FhirResource[]): AdHocMedicationInventoryRow[] {
  const byRef = new Map<string, FhirResource>();
  for (const resource of resources) if (resource.id) byRef.set(`${resource.resourceType}/${resource.id}`, resource);

  const rows: AdHocMedicationInventoryRow[] = [];

  for (const resource of resources) {
    if (resource.resourceType !== 'Observation') continue;
    const entry = parseInventoryStockEntry(resource as Observation);
    if (!entry) continue;

    const lotResource = byRef.get(`Medication/${entry.lotId}`);
    const lot = lotResource?.resourceType === 'Medication' ? parseInventoryLot(lotResource) : undefined;
    const location = byRef.get(`Location/${entry.locationId}`) as Location | undefined;
    const performer = entry.performerReference ? (byRef.get(entry.performerReference) as Practitioner) : undefined;
    const administration = entry.medicationAdministrationId
      ? (byRef.get(`MedicationAdministration/${entry.medicationAdministrationId}`) as MedicationAdministration)
      : undefined;
    const encounter = administration?.context?.reference
      ? (byRef.get(administration.context.reference) as Encounter)
      : undefined;
    const patient = administration?.subject?.reference
      ? (byRef.get(administration.subject.reference) as Patient)
      : undefined;
    const waste = entry.components?.find((component) => component.code === 'waste-amount');
    const unitCost = lot?.unitCost ?? null;

    rows.push({
      entryId: entry.id,
      // RAW ISO instant — the server never zone-formats dates. The client dataset derives the
      // viewer-local yyyy-MM-dd day in the browser.
      date: entry.effectiveDateTime,
      dateTime: entry.effectiveDateTime,
      entryType: entry.type,
      reason: entry.reason ?? null,
      note: entry.note ?? '',
      quantity: entry.quantity,
      unit: entry.unit,
      wasteAmount: waste?.value ?? null,
      wasteUnit: waste?.unit ?? '',
      unitCost,
      extendedCost: unitCost === null ? null : round2(entry.quantity * unitCost),
      performer: presentFullName(performer),
      performerId: entry.performerReference?.replace('Practitioner/', '') ?? '',
      clinic: location?.name ?? '',
      clinicId: entry.locationId,
      medication: lotResource?.resourceType === 'Medication' ? lotResource.code?.text ?? '' : '',
      medicationId: lot?.catalogMedicationId ?? '',
      lotId: entry.lotId,
      lotNumber: lot?.lotNumber ?? '',
      expirationDate: lot?.expirationDate ?? '',
      ndc: lot?.ndc ?? '',
      manufacturer: lot?.manufacturer ?? '',
      vendor: lot?.vendor ?? '',
      lotOnHand: lot?.onHand ?? null,
      appointmentId: encounter?.appointment?.[0]?.reference?.replace('Appointment/', '') ?? null,
      patientId: patient?.id ?? null,
      patientName: presentFullName(patient),
    });
  }

  return rows;
}

// The full fetch+map pipeline, separated from auth/transport so fixture tests can run it against a
// stubbed Oystehr client and assert the mapped rows parse with the endpoint's Zod schema — the same
// schema the runtime output validation uses.
export async function fetchAdHocMedicationInventoryRows(
  oystehr: Oystehr,
  params: AdHocMedicationInventoryInput
): Promise<AdHocMedicationInventoryRow[]> {
  const startedAt = Date.now();
  const resources = await getAllFhirSearchPages<FhirResource>(
    { resourceType: 'Observation', params: medicationInventorySearchParams(params.dateRange) },
    oystehr
  );
  const rows = buildMedicationInventoryRows(resources);
  console.log(
    `[adhoc] inventory entries: resources=${resources.length} rows=${rows.length} ms=${Date.now() - startedAt}`
  );
  return rows;
}
