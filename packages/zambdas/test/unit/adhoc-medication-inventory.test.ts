import Oystehr from '@oystehr/sdk';
import {
  Encounter,
  FhirResource,
  Location,
  Medication,
  MedicationAdministration,
  Observation,
  Patient,
  Practitioner,
} from 'fhir/r4b';
import {
  makeInventoryLot,
  makeInventoryStockEntry,
  makeMedicationInventoryExtension,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { AdHocMedicationInventoryOutputSchema } from 'utils/lib/types/adhoc/datasets/medication-inventory';
import { InHouseMedicationInventory } from 'utils/lib/types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import {
  fetchAdHocMedicationInventoryRows,
  medicationInventorySearchParams,
} from '../../src/shared/adhoc-datasets/medication-inventory';

// The fetch+map pipeline runs against a stubbed Oystehr client returning one lot's ledger with its
// included lot, clinic, performer and visit; the mapped rows must parse with the endpoint's own Output
// schema — the same schema the runtime validation uses.

const inventory: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 4, unit: 'mg', in: { amount: 2, unit: 'ml' } },
  use: 'single-use',
  reorderLevels: [],
};

const catalog: Medication & { id: string } = {
  resourceType: 'Medication',
  id: 'med-catalog',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ondansetron HCl Injection Solution 4 MG/2ML' },
  ],
  status: 'active',
  code: { coding: [{ system: CODE_SYSTEM_NDC, code: '0409-1234-01' }] },
  extension: [makeMedicationInventoryExtension(inventory)],
};

const lotInput = {
  locationId: 'loc-a',
  lotNumber: 'A123',
  expirationDate: '2027-03-31',
  ndc: '72572-0160-25',
  manufacturer: 'Civica',
  vendor: 'McKesson',
  unitCost: 1.8,
  unit: 'vial',
};

const lot: Medication = { ...withLotOnHand(makeInventoryLot(catalog, lotInput), 22), id: 'lot-1' };

const location: Location = { resourceType: 'Location', id: 'loc-a', name: 'Clinic A' };
const nurse: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  name: [{ given: ['Nina'], family: 'Nurse' }],
};
const patient: Patient = { resourceType: 'Patient', id: 'pat-1', name: [{ given: ['Maya'], family: 'Patel' }] };

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: { code: 'AMB' },
  appointment: [{ reference: 'Appointment/appt-1' }],
  subject: { reference: 'Patient/pat-1' },
};

const administration: MedicationAdministration = {
  resourceType: 'MedicationAdministration',
  id: 'ma-1',
  status: 'completed',
  medicationReference: { reference: 'Medication/med-catalog' },
  subject: { reference: 'Patient/pat-1' },
  context: { reference: 'Encounter/enc-1' },
  effectiveDateTime: '2026-10-02T15:10:00Z',
};

const base = {
  lotReference: 'Medication/lot-1',
  locationId: 'loc-a',
  unit: 'vial',
  performerReference: 'Practitioner/prac-1',
};

const entries: Observation[] = [
  {
    ...makeInventoryStockEntry({ ...base, type: 'received', quantity: 25, effectiveDateTime: '2026-10-01T14:02:00Z' }),
    id: 'entry-received',
  },
  {
    ...makeInventoryStockEntry({
      ...base,
      type: 'administered',
      reason: 'partial-dose-waste',
      quantity: -2,
      medicationAdministrationId: 'ma-1',
      effectiveDateTime: '2026-10-02T15:10:00Z',
      components: [{ code: 'waste-amount', value: 2, unit: 'mg' }],
    }),
    id: 'entry-administered',
  },
  {
    ...makeInventoryStockEntry({
      ...base,
      type: 'adjustment',
      reason: 'broken-container',
      quantity: -1,
      effectiveDateTime: '2026-10-03T09:00:00Z',
    }),
    id: 'entry-adjustment',
  },
  {
    ...makeInventoryStockEntry({
      ...base,
      type: 'count',
      reason: 'no-difference',
      quantity: 0,
      effectiveDateTime: '2026-10-04T08:00:00Z',
      components: [{ code: 'counted', value: 22, unit: 'vial' }],
    }),
    id: 'entry-count',
  },
];

// Never returned by the category search; here to show the mapper ignores a non-ledger Observation anyway.
const vitals: Observation = { resourceType: 'Observation', id: 'obs-vitals', status: 'final', code: { text: 'HR' } };

const dateRange = { start: '2026-10-01T00:00:00.000-04:00', end: '2026-10-31T23:59:59.999-04:00' };

const makeOystehr = (
  ledger: Observation[],
  included: FhirResource[]
): Oystehr & { fhir: { search: ReturnType<typeof vi.fn> } } => {
  const resources = [...ledger, ...included];
  const search = vi.fn(async () => ({
    total: ledger.length,
    entry: resources.map((resource) => ({
      resource,
      search: { mode: ledger.includes(resource as Observation) ? 'match' : 'include' },
    })),
    unbundle: () => resources,
  }));
  return { fhir: { search } } as unknown as Oystehr & { fhir: { search: ReturnType<typeof vi.fn> } };
};

describe('medication inventory dataset', () => {
  it('scopes the ledger search by category and the period, including the lot, clinic, performer and visit', () => {
    expect(medicationInventorySearchParams(dateRange)).toEqual([
      { name: 'category', value: expect.stringMatching(/\|inventory-stock-entry$/) },
      { name: 'date', value: `ge${dateRange.start}` },
      { name: 'date', value: `le${dateRange.end}` },
      { name: '_include', value: 'Observation:subject' },
      { name: '_include', value: 'Observation:focus' },
      { name: '_include', value: 'Observation:performer' },
      { name: '_include', value: 'Observation:part-of' },
      { name: '_include:iterate', value: 'MedicationAdministration:context' },
      { name: '_include:iterate', value: 'MedicationAdministration:subject' },
      { name: '_sort', value: 'date' },
    ]);
  });

  it('maps one row per stock entry with its lot, clinic, cost, waste and visit', async () => {
    const oystehr = makeOystehr(entries, [lot, location, nurse, administration, encounter, patient, vitals]);

    const rows = await fetchAdHocMedicationInventoryRows(oystehr, { dateRange });

    expect(oystehr.fhir.search).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Observation',
        params: expect.arrayContaining(medicationInventorySearchParams(dateRange)),
      })
    );
    expect(() => AdHocMedicationInventoryOutputSchema.parse({ rows })).not.toThrow();
    expect(rows.map((row) => row.entryId)).toEqual([
      'entry-received',
      'entry-administered',
      'entry-adjustment',
      'entry-count',
    ]);

    // received with cost: spend = quantity × unit cost
    expect(rows[0]).toMatchObject({
      date: '2026-10-01T14:02:00Z',
      dateTime: '2026-10-01T14:02:00Z',
      entryType: 'received',
      reason: null,
      note: '',
      quantity: 25,
      unit: 'vial',
      wasteAmount: null,
      wasteUnit: '',
      unitCost: 1.8,
      extendedCost: 45,
      performer: 'Nina Nurse',
      performerId: 'prac-1',
      clinic: 'Clinic A',
      clinicId: 'loc-a',
      medication: 'Ondansetron HCl Injection Solution 4 MG/2ML',
      medicationId: 'med-catalog',
      lotId: 'lot-1',
      lotNumber: 'A123',
      expirationDate: '2027-03-31',
      ndc: '72572-0160-25',
      manufacturer: 'Civica',
      vendor: 'McKesson',
      lotOnHand: 22,
      appointmentId: null,
      patientId: null,
      patientName: '',
    });

    // administered at a visit, with the unused part of the vial recorded as waste
    expect(rows[1]).toMatchObject({
      entryType: 'administered',
      reason: 'partial-dose-waste',
      quantity: -2,
      extendedCost: -3.6,
      wasteAmount: 2,
      wasteUnit: 'mg',
      appointmentId: 'appt-1',
      patientId: 'pat-1',
      patientName: 'Maya Patel',
    });

    // adjustment with a reason
    expect(rows[2]).toMatchObject({
      entryType: 'adjustment',
      reason: 'broken-container',
      quantity: -1,
      extendedCost: -1.8,
    });

    // a count that matched the shelf
    expect(rows[3]).toMatchObject({ entryType: 'count', reason: 'no-difference', quantity: 0, extendedCost: 0 });
  });

  it("prices each receipt at its own cost and vendor, and everything else at the lot's latest", async () => {
    const latestLot: Medication = {
      ...withLotOnHand(makeInventoryLot(catalog, { ...lotInput, vendor: 'Henry Schein', unitCost: 2.5 }), 33),
      id: 'lot-1',
    };
    const receipts: Observation[] = [
      {
        ...makeInventoryStockEntry({
          ...base,
          type: 'received',
          quantity: 25,
          effectiveDateTime: '2026-10-01T14:02:00Z',
          vendor: 'McKesson',
          unitCost: 1.8,
        }),
        id: 'receipt-1',
      },
      {
        ...makeInventoryStockEntry({
          ...base,
          type: 'received',
          quantity: 10,
          effectiveDateTime: '2026-10-05T14:02:00Z',
          vendor: 'Henry Schein',
          unitCost: 2.5,
        }),
        id: 'receipt-2',
      },
      entries[2],
    ];
    const oystehr = makeOystehr(receipts, [latestLot, location, nurse]);

    const rows = await fetchAdHocMedicationInventoryRows(oystehr, { dateRange });

    expect(() => AdHocMedicationInventoryOutputSchema.parse({ rows })).not.toThrow();
    expect(rows[0]).toMatchObject({ entryId: 'receipt-1', vendor: 'McKesson', unitCost: 1.8, extendedCost: 45 });
    expect(rows[1]).toMatchObject({ entryId: 'receipt-2', vendor: 'Henry Schein', unitCost: 2.5, extendedCost: 25 });
    expect(rows[2]).toMatchObject({
      entryType: 'adjustment',
      vendor: 'Henry Schein',
      unitCost: 2.5,
      extendedCost: -2.5,
    });
  });

  it('leaves cost null when the lot was received without one', async () => {
    const freeLot: Medication = {
      ...withLotOnHand(makeInventoryLot(catalog, { ...lotInput, unitCost: undefined }), 25),
      id: 'lot-1',
    };
    const oystehr = makeOystehr([entries[0]], [freeLot, location, nurse]);

    const rows = await fetchAdHocMedicationInventoryRows(oystehr, { dateRange });

    expect(() => AdHocMedicationInventoryOutputSchema.parse({ rows })).not.toThrow();
    expect(rows[0]).toMatchObject({ unitCost: null, extendedCost: null, lotOnHand: 25 });
  });
});
