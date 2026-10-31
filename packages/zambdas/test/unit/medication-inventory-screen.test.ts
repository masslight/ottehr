import Oystehr from '@oystehr/sdk';
import { Medication, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  INVENTORY_LOT_CLINIC_TAG_SYSTEM,
  INVENTORY_LOT_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_IDENTIFIER_VALUE,
  makeInventoryLot,
  makeInventoryStockEntry,
  makeMedicationInventoryExtension,
  parseInventoryStockEntry,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import {
  InHouseMedicationInventory,
  InventoryLot,
  InventoryStockEntry,
} from 'utils/lib/types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import {
  performEffect as adjustPerformEffect,
  stockEntryForAction,
} from '../../src/ehr/configuration/in-house-medications/adjust-medication-inventory/index';
import { validateRequestParameters as validateAdjust } from '../../src/ehr/configuration/in-house-medications/adjust-medication-inventory/validateRequestParameters';
import { performEffect as listPerformEffect } from '../../src/ehr/configuration/in-house-medications/list-medication-inventory/index';
import { validateRequestParameters as validateList } from '../../src/ehr/configuration/in-house-medications/list-medication-inventory/validateRequestParameters';
import {
  buildAllClinicsRows,
  buildClinicRows,
  buildHistory,
  expirationMarkers,
  sortLots,
  TrackedDrug,
} from '../../src/shared/medication-inventory-screen';
import { ZambdaInput } from '../../src/shared/types/common';

vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({
  getAllFhirSearchPages: vi.fn(async (params: any, oystehr: any) => oystehr.fhir.search(params).unbundle()),
}));

const LOCATION_UUID = '6f1c2a4e-2222-4b2a-9c3d-000000000002';
const LOT_UUID = '6f1c2a4e-3333-4b2a-9c3d-000000000003';

const today = DateTime.fromISO('2026-10-30T12:00:00', { zone: 'utc' });

const lot = (overrides: Partial<InventoryLot>): InventoryLot => ({
  id: 'lot-1',
  catalogMedicationId: 'ondansetron',
  locationId: 'main',
  lotNumber: 'A1',
  expirationDate: '2027-06-30',
  unit: 'vial',
  onHand: 10,
  status: 'active',
  ...overrides,
});

const drug = (
  medicationId: string,
  name: string,
  reorderLevels: { locationId: string; level: number }[]
): TrackedDrug => ({
  medicationId,
  name,
  inventory: { countedAs: 'vial', eachContains: { amount: 4, unit: 'mg' }, use: 'single-use', reorderLevels },
});

const clinics = [
  { id: 'west', name: 'Westfield Clinic' },
  { id: 'main', name: 'Main Street Clinic' },
  { id: 'north', name: 'Northside Urgent Care' },
];

// ─── markers ──────────────────────────────────────────────────────────────────

describe('expirationMarkers', () => {
  it.each([
    ['yesterday', '2026-10-29', ['expired']],
    ['today', '2026-10-30', ['expiring']],
    ['in 30 days', '2026-11-29', ['expiring']],
    ['in 31 days', '2026-11-30', []],
    ['no date', undefined, []],
    ['garbage', 'soon', []],
  ])('%s', (_label, date, expected) => {
    expect(expirationMarkers(date, today)).toEqual(expected);
  });
});

// ─── all clinics ──────────────────────────────────────────────────────────────

describe('buildAllClinicsRows', () => {
  const drugs = [
    drug('ketorolac', 'Ketorolac', [
      { locationId: 'main', level: 8 },
      { locationId: 'north', level: 8 },
      { locationId: 'west', level: 8 },
    ]),
    drug('ondansetron', 'Ondansetron', [
      { locationId: 'main', level: 10 },
      { locationId: 'north', level: 6 },
    ]),
    drug('mupirocin', 'Mupirocin', []),
  ];
  const lots = [
    lot({ id: 'o-main-1', locationId: 'main', onHand: 4, expirationDate: '2026-11-15' }),
    lot({ id: 'o-main-2', locationId: 'main', onHand: 18, expirationDate: '2027-06-30' }),
    lot({ id: 'o-main-3', locationId: 'main', onHand: 0, expirationDate: '2026-01-01' }), // no stock: ignored for expiry
    lot({ id: 'o-north', locationId: 'north', onHand: 4, expirationDate: '2027-04-30' }),
    lot({
      id: 'k-main',
      catalogMedicationId: 'ketorolac',
      locationId: 'main',
      onHand: -2,
      expirationDate: '2027-01-31',
    }),
    lot({ id: 'k-north', catalogMedicationId: 'ketorolac', locationId: 'north', onHand: 3 }),
    lot({ id: 'k-west', catalogMedicationId: 'ketorolac', locationId: 'west', onHand: 9 }),
  ];
  const rows = buildAllClinicsRows(drugs, lots, clinics, today);

  it('lists every tracked drug by name, with totals from the lots on-hand caches', () => {
    expect(rows.map((row) => [row.name, row.onHand])).toEqual([
      ['Ketorolac', 10],
      ['Mupirocin', 0],
      ['Ondansetron', 26],
    ]);
  });

  it('counts clinics below their reorder level against clinics that have one, and finds the earliest expiration', () => {
    const ondansetron = rows[2];
    expect(ondansetron).toMatchObject({
      clinicsBelowReorderLevel: 1,
      clinicsWithReorderLevel: 2,
      earliestExpiration: '2026-11-15',
      markers: ['low', 'expiring'],
    });
    expect(
      ondansetron.clinics.map((line) => [line.locationName, line.onHand, line.reorderLevel, line.markers])
    ).toEqual([
      ['Main Street Clinic', 22, 10, ['expiring']],
      ['Northside Urgent Care', 4, 6, ['low']],
      ['Westfield Clinic', 0, undefined, []],
    ]);
    expect(ondansetron.clinics[0].earliestExpiration).toBe('2026-11-15');
    expect(ondansetron.clinics[2].earliestExpiration).toBeUndefined();
  });

  it('marks a total below zero and a clinic below zero and low', () => {
    const ketorolac = rows[0];
    expect(ketorolac.markers).toEqual(['low']);
    expect(ketorolac.clinics[0]).toMatchObject({ locationId: 'main', onHand: -2, markers: ['low', 'below-zero'] });
    expect(ketorolac.clinicsBelowReorderLevel).toBe(2);
    expect(buildAllClinicsRows(drugs, [lots[4]], clinics, today)[0].markers).toEqual(['low', 'below-zero']);
  });

  it('shows a drug with no lots as empty everywhere', () => {
    expect(rows[1]).toMatchObject({ onHand: 0, clinicsWithReorderLevel: 0, markers: [], lots: [] });
    expect(rows[1].earliestExpiration).toBeUndefined();
    expect(rows[1].clinics).toHaveLength(3);
  });
});

// ─── one clinic ───────────────────────────────────────────────────────────────

describe('buildClinicRows', () => {
  const drugs = [drug('ondansetron', 'Ondansetron', [{ locationId: 'main', level: 10 }])];
  const lots = [
    lot({ id: 'hk', lotNumber: 'HK3302', onHand: 18, expirationDate: '2027-06-30' }),
    lot({ id: 'b8', lotNumber: 'B88120', onHand: 2, expirationDate: '2026-09-30' }),
    lot({ id: 'c2', lotNumber: 'C24117', onHand: 4, expirationDate: '2026-11-15' }),
    lot({ id: 'other-clinic', locationId: 'north', onHand: 50, expirationDate: '2026-01-01' }),
  ];

  it('lists the clinic lots soonest expiration first with expired lots last, and marks each', () => {
    const [row] = buildClinicRows(drugs, lots, 'main', today);
    // an expired lot that still has stock is the earliest expiration (it needs attention)
    expect(row).toMatchObject({ onHand: 24, reorderLevel: 10, earliestExpiration: '2026-09-30', markers: ['expired'] });
    expect(row.lots.map((l) => [l.lotNumber, l.markers])).toEqual([
      ['C24117', ['expiring']],
      ['HK3302', []],
      ['B88120', ['expired']],
    ]);
  });

  it('marks the drug low when on hand is at or below the reorder level, and below zero', () => {
    const [low] = buildClinicRows(drugs, [lots[0]], 'main', today);
    expect(low).toMatchObject({ onHand: 18, markers: [] });
    expect(buildClinicRows(drugs, [lot({ onHand: 10 })], 'main', today)[0].markers).toEqual(['low']);
    const [lowExpired] = buildClinicRows(drugs, [lots[1]], 'main', today);
    expect(lowExpired.markers).toEqual(['low', 'expired']);
    expect(lowExpired.earliestExpiration).toBe('2026-09-30');
    const [negative] = buildClinicRows(drugs, [lot({ onHand: -1 })], 'main', today);
    expect(negative.markers).toEqual(['low', 'below-zero']);
    expect(negative.lots[0].markers).toEqual(['below-zero']);
  });

  it('sorts by lot number within the same expiration date', () => {
    expect(sortLots([lot({ lotNumber: 'B' }), lot({ lotNumber: 'A' })], today).map((l) => l.lotNumber)).toEqual([
      'A',
      'B',
    ]);
  });
});

// ─── history ──────────────────────────────────────────────────────────────────

const stockEntry = (overrides: Partial<InventoryStockEntry>): InventoryStockEntry => ({
  id: 'e',
  lotId: 'lot-1',
  locationId: 'main',
  type: 'received',
  quantity: 25,
  unit: 'vial',
  effectiveDateTime: '2026-09-02T15:15:00Z',
  ...overrides,
});

describe('buildHistory', () => {
  it('returns newest first with the running total after each entry, and resolves who and which visit', () => {
    const entries = [
      stockEntry({ id: 'e1', quantity: 25, performerReference: 'Practitioner/kb' }),
      stockEntry({ id: 'e2', type: 'administered', quantity: -1, medicationAdministrationId: 'ma-1' }),
      stockEntry({
        id: 'e3',
        type: 'count',
        reason: 'count-adjustment',
        quantity: -2,
        performerReference: 'Practitioner/x',
      }),
      stockEntry({ id: 'e4', type: 'administration-reversed', quantity: 1, medicationAdministrationId: 'ma-1' }),
    ];
    const history = buildHistory(entries, {
      performers: new Map([['Practitioner/kb', 'Kim Brooks']]),
      visits: new Map([['ma-1', { appointmentId: 'appt-1', patientName: 'Sam Patel', date: '2026-10-29T14:00:00Z' }]]),
    });
    expect(history.map((entry) => [entry.id, entry.onHandAfter])).toEqual([
      ['e4', 23],
      ['e3', 22],
      ['e2', 24],
      ['e1', 25],
    ]);
    expect(history[3].performerName).toBe('Kim Brooks');
    expect(history[1].performerName).toBeUndefined();
    expect(history[2].visit).toEqual({
      appointmentId: 'appt-1',
      patientName: 'Sam Patel',
      date: '2026-10-29T14:00:00Z',
    });
    expect(history[3].visit).toBeUndefined();
  });

  it('is empty for an empty ledger', () => {
    expect(buildHistory([], { performers: new Map(), visits: new Map() })).toEqual([]);
  });
});

// ─── list-medication-inventory zambda ─────────────────────────────────────────

const inventory: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 4, unit: 'mg' },
  use: 'single-use',
  reorderLevels: [{ locationId: 'main', level: 10 }],
};
const catalog: Medication & { id: string } = {
  resourceType: 'Medication',
  id: 'ondansetron',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ondansetron 4 MG/2ML' },
  ],
  status: 'active',
  extension: [makeMedicationInventoryExtension(inventory)],
};
const untracked: Medication = { ...catalog, id: 'untracked', extension: undefined };
const lotResource: Medication = {
  ...withLotOnHand(
    makeInventoryLot(catalog, {
      locationId: 'main',
      lotNumber: 'A1',
      expirationDate: '2027-06-30',
      ndc: '1',
      unit: 'vial',
    }),
    6
  ),
  id: 'lot-1',
  meta: { versionId: '2' },
};

type MockOystehr = Oystehr & {
  fhir: { get: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
};

const makeMockOystehr = (byResourceType: Record<string, unknown[]>): MockOystehr => {
  const transaction = vi.fn().mockImplementation(({ requests }: { requests: { resource: any }[] }) => ({
    entry: requests.map((request, index) => ({
      resource: { ...request.resource, id: request.resource.id ?? `new-${index}` },
    })),
  }));
  const search = vi.fn().mockImplementation(({ resourceType, params }: { resourceType: string; params: any[] }) => ({
    unbundle: () => {
      if (resourceType !== 'Medication') return byResourceType[resourceType] ?? [];
      const isLotSearch = params.some(
        (param) => param.name === 'identifier' && String(param.value).startsWith(INVENTORY_LOT_IDENTIFIER_SYSTEM)
      );
      return byResourceType[isLotSearch ? 'Lot' : 'Medication'] ?? [];
    },
  }));
  return { fhir: { get: vi.fn(), search, transaction } } as unknown as MockOystehr;
};

const createInput = (body: Record<string, unknown>, authorized = true): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: authorized ? { Authorization: 'Bearer test-token' } : {},
  secrets: {} as any,
});

describe('list-medication-inventory', () => {
  it('validates the three views', () => {
    expect(validateList(createInput({ view: 'all-clinics' })).view).toBe('all-clinics');
    expect(validateList(createInput({ view: 'clinic', locationId: LOCATION_UUID }))).toMatchObject({
      locationId: LOCATION_UUID,
    });
    expect(validateList(createInput({ view: 'lot-history', lotId: LOT_UUID }))).toMatchObject({ lotId: LOT_UUID });
    expect(() => validateList(createInput({ view: 'clinic' }))).toThrow();
    // a comma would turn the FHIR search value into an OR
    expect(() => validateList(createInput({ view: 'clinic', locationId: `${LOCATION_UUID},other` }))).toThrow();
    expect(() => validateList(createInput({ view: 'everything' }))).toThrow();
  });

  it('searches lots scoped by the lot identifier (clinic tag for one clinic, active elsewhere), never the ledger', async () => {
    const oystehr = makeMockOystehr({
      Medication: [catalog, untracked],
      Lot: [lotResource],
      Location: [{ resourceType: 'Location', id: 'main', name: 'Main Street Clinic' }],
    });
    const clinic = await listPerformEffect(oystehr, { view: 'clinic', locationId: 'main' }, today);
    expect(clinic.drugs).toHaveLength(1);
    expect(clinic.drugs[0]).toMatchObject({
      name: 'Ondansetron 4 MG/2ML',
      onHand: 6,
      reorderLevel: 10,
      markers: ['low'],
    });
    expect(clinic.drugs[0].lots[0]).toMatchObject({ id: 'lot-1', lotNumber: 'A1', onHand: 6 });

    const lotSearches = oystehr.fhir.search.mock.calls
      .map(([call]) => call)
      .filter(
        (call) =>
          call.resourceType === 'Medication' &&
          call.params.some((p: any) => String(p.value).startsWith(INVENTORY_LOT_IDENTIFIER_SYSTEM))
      );
    expect(lotSearches).toHaveLength(1);
    // the clinic view includes empty lots (they can still be counted and adjusted)
    expect(lotSearches[0].params).toEqual([
      { name: 'identifier', value: `${INVENTORY_LOT_IDENTIFIER_SYSTEM}|${INVENTORY_LOT_IDENTIFIER_VALUE}` },
      { name: '_tag', value: `${INVENTORY_LOT_CLINIC_TAG_SYSTEM}|main` },
    ]);
    expect(oystehr.fhir.search.mock.calls.some(([call]) => call.resourceType === 'Observation')).toBe(false);

    const all = await listPerformEffect(oystehr, { view: 'all-clinics' }, today);
    expect(all.drugs[0].clinics).toEqual([
      {
        locationId: 'main',
        locationName: 'Main Street Clinic',
        onHand: 6,
        reorderLevel: 10,
        earliestExpiration: '2027-06-30',
        markers: ['low'],
      },
    ]);
    expect(oystehr.fhir.search.mock.calls.some(([call]) => call.resourceType === 'Observation')).toBe(false);
  });

  it('builds a lot history from the ledger with names and visits resolved', async () => {
    const ledger: Observation[] = [
      {
        ...makeInventoryStockEntry({
          lotReference: 'Medication/lot-1',
          locationId: 'main',
          type: 'received',
          quantity: 5,
          unit: 'vial',
          performerReference: 'Practitioner/kb',
          effectiveDateTime: '2026-10-01T10:00:00Z',
        }),
        id: 'e1',
      },
      {
        ...makeInventoryStockEntry({
          lotReference: 'Medication/lot-1',
          locationId: 'main',
          type: 'administered',
          quantity: -1,
          unit: 'vial',
          medicationAdministrationId: 'ma-1',
          effectiveDateTime: '2026-10-02T10:00:00Z',
        }),
        id: 'e2',
      },
    ];
    const oystehr = makeMockOystehr({
      Observation: ledger,
      Practitioner: [{ resourceType: 'Practitioner', id: 'kb', name: [{ given: ['Kim'], family: 'Brooks' }] }],
      MedicationAdministration: [
        {
          resourceType: 'MedicationAdministration',
          id: 'ma-1',
          subject: { reference: 'Patient/p1' },
          context: { reference: 'Encounter/enc-1' },
        },
        { resourceType: 'Patient', id: 'p1', name: [{ given: ['Sam'], family: 'Patel' }] },
        {
          resourceType: 'Encounter',
          id: 'enc-1',
          appointment: [{ reference: 'Appointment/appt-1' }],
          period: { start: '2026-10-02T09:30:00Z' },
        },
      ],
    });
    const { entries, drugs } = await listPerformEffect(oystehr, { view: 'lot-history', lotId: 'lot-1' }, today);
    expect(drugs).toEqual([]);
    expect(entries.map((entry) => [entry.id, entry.onHandAfter])).toEqual([
      ['e2', 4],
      ['e1', 5],
    ]);
    expect(entries[0].visit).toEqual({
      appointmentId: 'appt-1',
      patientName: 'Sam Patel',
      date: '2026-10-02T09:30:00Z',
    });
    expect(entries[1].performerName).toBe('Kim Brooks');

    const [ledgerSearch] = oystehr.fhir.search.mock.calls
      .map(([call]) => call)
      .filter((c) => c.resourceType === 'Observation');
    expect(ledgerSearch.params).toContainEqual({ name: 'subject', value: 'Medication/lot-1' });
    const [visitSearch] = oystehr.fhir.search.mock.calls
      .map(([call]) => call)
      .filter((c) => c.resourceType === 'MedicationAdministration');
    expect(visitSearch.params).toContainEqual({ name: '_id', value: 'ma-1' });
  });

  it('skips the name lookups when no entry has a performer or a visit', async () => {
    const oystehr = makeMockOystehr({ Observation: [] });
    expect((await listPerformEffect(oystehr, { view: 'lot-history', lotId: 'lot-1' }, today)).entries).toEqual([]);
    expect(oystehr.fhir.search).toHaveBeenCalledTimes(1);
  });
});

// ─── adjust-medication-inventory zambda ───────────────────────────────────────

const adjustBody = { action: 'adjust', lotId: LOT_UUID, direction: 'remove', quantity: 2, reason: 'expired' };
const countBody = { action: 'count', lotId: LOT_UUID, counted: 5 };

describe('adjust-medication-inventory - validateRequestParameters', () => {
  it('accepts an adjustment and a count, keeping the user token', () => {
    expect(validateAdjust(createInput(adjustBody))).toMatchObject({ ...adjustBody, userToken: 'test-token' });
    expect(validateAdjust(createInput(countBody))).toMatchObject(countBody);
    expect(validateAdjust(createInput({ ...adjustBody, reason: 'other', note: 'spilled' }))).toMatchObject({
      note: 'spilled',
    });
    expect(validateAdjust(createInput({ ...countBody, counted: 0 }))).toMatchObject({ counted: 0 });
  });

  it.each([
    ['no auth header', adjustBody, false],
    ['zero quantity', { ...adjustBody, quantity: 0 }],
    ['negative quantity', { ...adjustBody, quantity: -1 }],
    ['fractional quantity', { ...adjustBody, quantity: 1.5 }],
    ['a reason outside the adjustment list', { ...adjustBody, reason: 'count-adjustment' }],
    ['a reason the MAR owns', { ...adjustBody, reason: 'partial-dose-waste' }],
    ['other without text', { ...adjustBody, reason: 'other' }],
    ['other with blank text', { ...adjustBody, reason: 'other', note: '  ' }],
    ['an unknown direction', { ...adjustBody, direction: 'up' }],
    ['a negative count', { ...countBody, counted: -1 }],
    ['a fractional count', { ...countBody, counted: 2.5 }],
    ['a count without a lot', { action: 'count', counted: 2 }],
    ['a lot id that is not a FHIR id', { ...countBody, lotId: 'lot-1' }],
  ])('rejects %s', (_label, body, authorized = true) => {
    expect(() => validateAdjust(createInput(body, authorized))).toThrow();
  });
});

describe('adjust-medication-inventory - stockEntryForAction', () => {
  const parsedLot = lot({ onHand: 6, locationId: 'main', unit: 'vial' });
  const when = '2026-10-30T14:00:00Z';

  it('writes a signed adjustment with its reason and note', () => {
    expect(
      stockEntryForAction(
        { action: 'adjust', lotId: 'lot-1', direction: 'remove', quantity: 2, reason: 'broken-container' },
        parsedLot,
        'Practitioner/me',
        when
      )
    ).toEqual({
      locationId: 'main',
      unit: 'vial',
      performerReference: 'Practitioner/me',
      effectiveDateTime: when,
      type: 'adjustment',
      reason: 'broken-container',
      quantity: -2,
    });
    expect(
      stockEntryForAction(
        { action: 'adjust', lotId: 'lot-1', direction: 'add', quantity: 3, reason: 'other', note: 'found a box' },
        parsedLot,
        'Practitioner/me',
        when
      )
    ).toMatchObject({ quantity: 3, reason: 'other', note: 'found a box' });
  });

  it('records a count as the difference from on hand, keeping the counted number', () => {
    expect(
      stockEntryForAction({ action: 'count', lotId: 'lot-1', counted: 5 }, parsedLot, 'Practitioner/me', when)
    ).toEqual({
      locationId: 'main',
      unit: 'vial',
      performerReference: 'Practitioner/me',
      effectiveDateTime: when,
      type: 'count',
      reason: 'count-adjustment',
      quantity: -1,
      components: [{ code: 'counted', value: 5, unit: 'vial' }],
    });
    expect(
      stockEntryForAction({ action: 'count', lotId: 'lot-1', counted: 9 }, parsedLot, 'Practitioner/me', when)
    ).toMatchObject({ quantity: 3, reason: 'count-adjustment' });
  });

  it('records a matching count as 0 with "no difference"', () => {
    expect(
      stockEntryForAction({ action: 'count', lotId: 'lot-1', counted: 6 }, parsedLot, 'Practitioner/me', when)
    ).toMatchObject({
      type: 'count',
      reason: 'no-difference',
      quantity: 0,
      components: [{ code: 'counted', value: 6 }],
    });
  });

  it('counts from a lot that is below zero', () => {
    expect(
      stockEntryForAction({ action: 'count', lotId: 'lot-1', counted: 0 }, { ...parsedLot, onHand: -2 }, 'P/me', when)
    ).toMatchObject({ quantity: 2, reason: 'count-adjustment' });
  });
});

describe('adjust-medication-inventory - performEffect', () => {
  it('writes the entry through the ledger transaction and returns the lot and entry', async () => {
    const ledger: Observation[] = [
      {
        ...makeInventoryStockEntry({
          lotReference: 'Medication/lot-1',
          locationId: 'main',
          type: 'received',
          quantity: 6,
          unit: 'vial',
          effectiveDateTime: '2026-10-01T10:00:00Z',
        }),
        id: 'e1',
      },
    ];
    const oystehr = makeMockOystehr({ Observation: ledger });
    oystehr.fhir.get.mockResolvedValue(lotResource);
    const result = await adjustPerformEffect(
      oystehr,
      { action: 'count', lotId: 'lot-1', counted: 4 },
      'Practitioner/me'
    );

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(requests.map((r: any) => r.method)).toEqual(['POST', 'PUT']);
    expect(requests[1].ifMatch).toBe('W/"2"');
    expect(parseInventoryStockEntry({ ...requests[0].resource, id: 'posted' })).toMatchObject({
      type: 'count',
      reason: 'count-adjustment',
      quantity: -2,
      performerReference: 'Practitioner/me',
      components: [{ code: 'counted', value: 4, unit: 'vial' }],
    });
    expect(result.lot).toMatchObject({ id: 'lot-1', onHand: 4 });
    expect(result.entry).toMatchObject({ type: 'count', quantity: -2 });
  });

  it('rejects a Medication that is not a lot before writing anything', async () => {
    const oystehr = makeMockOystehr({});
    oystehr.fhir.get.mockResolvedValue(catalog);
    await expect(adjustPerformEffect(oystehr, { ...adjustBody } as any, 'Practitioner/me')).rejects.toMatchObject({
      code: expect.any(Number),
    });
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });
});
