import Oystehr from '@oystehr/sdk';
import { Encounter, Medication, MedicationAdministration, Observation } from 'fhir/r4b';
import { makeInventoryLot, makeMedicationInventoryExtension } from 'utils/lib/fhir/medication-inventory';
import { getVaccineDoseFunding, makeVfcBorrowingObservation, parseVfcBorrowingObservation } from 'utils/lib/fhir/vfc';
import { VACCINE_DEFAULT_INVENTORY } from 'utils/lib/types/api/config/in-house-medications';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_CATALOG_ID_IDENTIFIER_SYSTEM,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import { applyVaccineDoseFunding, fillFundingFromInventoryLot } from '../../src/ehr/immunization/vaccine-stock';
import { recordVfcBorrowing } from '../../src/shared/vfc';

const bundle = <T>(resources: T[]): { unbundle: () => T[] } => ({ unbundle: () => resources });

const catalog: Medication & { id: string } = {
  resourceType: 'Medication',
  id: 'cat-mmr',
  status: 'active',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'MMR' },
  ],
  code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: '03' }] },
};

const administration = (lotNumber: string): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'ma-1',
  status: 'completed',
  subject: { reference: 'Patient/pat-1' },
  context: { reference: 'Encounter/enc-1' },
  medicationReference: { reference: '#medication' },
  contained: [
    {
      resourceType: 'Medication',
      id: 'medication',
      identifier: [
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'MMR' },
        { system: MEDICATION_CATALOG_ID_IDENTIFIER_SYSTEM, value: 'cat-mmr' },
      ],
      batch: { lotNumber, expirationDate: '2027-06-30' },
    },
  ],
});

describe('the dose carries its stock and the eligibility that day', () => {
  it('writes and reads the funding details on the administration', () => {
    const ma = administration('Y0112');
    applyVaccineDoseFunding(ma, {
      fundingSource: 'vfc',
      vfcEligibility: 'V01',
      borrowingReason: 'Short-dated vaccine would expire unused',
    });
    expect(getVaccineDoseFunding(ma)).toEqual({
      fundingSource: 'vfc',
      vfcEligibility: 'V01',
      borrowingReason: 'Short-dated vaccine would expire unused',
    });

    // a typed lot has no stock: the details go away
    applyVaccineDoseFunding(ma, { lot: 'TYPED' });
    expect(getVaccineDoseFunding(ma)).toEqual({});
    expect(ma.extension).toBeUndefined();
  });

  it('leaves other extensions alone', () => {
    const ma = { ...administration('Y0112'), extension: [{ url: 'https://example.com/other', valueBoolean: true }] };
    applyVaccineDoseFunding(ma, { fundingSource: 'private', vfcEligibility: 'V01' });
    expect(ma.extension).toHaveLength(2);
    expect(ma.extension?.[0]).toEqual({ url: 'https://example.com/other', valueBoolean: true });
  });
});

describe('fillFundingFromInventoryLot', () => {
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'in-progress',
    class: { code: 'AMB' },
    location: [{ location: { reference: 'Location/loc-a' } }],
  };
  const tracked = { ...catalog, extension: [makeMedicationInventoryExtension(VACCINE_DEFAULT_INVENTORY)] };
  const vfcLot = {
    ...makeInventoryLot(tracked, {
      locationId: 'loc-a',
      lotNumber: 'Y0112',
      expirationDate: '2027-06-30',
      ndc: '00006-4681-00',
      mvx: 'MSD',
      fundingSource: 'vfc',
      unit: 'dose',
    }),
    id: 'lot-1',
  };
  const mockOystehr = (): Oystehr =>
    ({
      fhir: {
        get: vi.fn().mockImplementation(async ({ resourceType }: { resourceType: string }) => {
          if (resourceType === 'Encounter') return encounter;
          if (resourceType === 'Medication') return tracked;
          throw new Error(`unexpected get ${resourceType}`);
        }),
        search: vi.fn().mockImplementation(async ({ resourceType }: { resourceType: string }) => {
          if (resourceType === 'Medication') return bundle([vfcLot]);
          throw new Error(`unexpected search ${resourceType}`);
        }),
      },
    }) as unknown as Oystehr;

  it('takes the stock from the inventory lot the order names, whatever the screen sent', async () => {
    const details = { lot: 'Y0112', fundingSource: 'private' as const, vfcEligibility: 'V01' as const };
    await fillFundingFromInventoryLot(mockOystehr(), administration('Y0112'), details);
    expect(details.fundingSource).toBe('vfc');
  });

  it('keeps what the screen said for a typed lot that is not in stock', async () => {
    const details = { lot: 'TYPED', fundingSource: 'private' as const };
    const oystehr = mockOystehr();
    (oystehr.fhir.search as ReturnType<typeof vi.fn>).mockResolvedValue(bundle([]));
    await fillFundingFromInventoryLot(oystehr, administration('TYPED'), details);
    expect(details.fundingSource).toBe('private');
  });
});

describe('recordVfcBorrowing', () => {
  const encounter: Encounter = {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'in-progress',
    class: { code: 'AMB' },
    location: [{ location: { reference: 'Location/loc-a' } }],
  };
  const lot = {
    ...makeInventoryLot(catalog, {
      locationId: 'loc-a',
      lotNumber: 'Y0112',
      expirationDate: '2027-06-30',
      ndc: '00006-4681-00',
      mvx: 'MSD',
      fundingSource: 'vfc',
      unit: 'dose',
    }),
    id: 'lot-1',
  };

  const mockOystehr = (existingBorrowings: Observation[] = []): Oystehr => {
    const search = vi.fn().mockImplementation(async ({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Observation') return bundle(existingBorrowings);
      if (resourceType === 'Medication') return bundle([lot]);
      throw new Error(`unexpected search ${resourceType}`);
    });
    const get = vi.fn().mockResolvedValue(encounter);
    const create = vi.fn().mockImplementation(async (resource: Observation) => ({ ...resource, id: 'borrow-1' }));
    const update = vi.fn().mockImplementation(async (resource: Observation) => resource);
    const patch = vi.fn().mockResolvedValue({});
    return { fhir: { search, get, create, update, patch } } as unknown as Oystehr;
  };
  const calls = (oystehr: Oystehr, method: 'create' | 'update' | 'patch'): unknown[][] =>
    (oystehr.fhir[method] as ReturnType<typeof vi.fn>).mock.calls;
  /** The row an earlier administration of ma-1 wrote: VFC stock to a V01 child, lot-1. */
  const loggedRow = (reason = 'x'): Observation => ({
    ...makeVfcBorrowingObservation({
      patientId: 'pat-1',
      lotId: 'lot-1',
      locationId: 'loc-a',
      medicationAdministrationId: 'ma-1',
      fundingSource: 'vfc',
      vfcEligibility: 'V01',
      reason,
      performerReference: 'Practitioner/nurse',
      effectiveDateTime: '2026-11-10T15:00:00.000Z',
    }),
    id: 'existing',
  });

  it('logs a VFC dose given to a child who is not eligible, against the lot it came from', async () => {
    const ma = administration('Y0112');
    applyVaccineDoseFunding(ma, {
      fundingSource: 'vfc',
      vfcEligibility: 'V01',
      borrowingReason: 'Ordering error left this stock short',
    });
    const oystehr = mockOystehr();

    await recordVfcBorrowing(oystehr, ma, 'Practitioner/nurse');

    const created = (oystehr.fhir.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as Observation;
    expect(parseVfcBorrowingObservation({ ...created, id: 'borrow-1' })).toMatchObject({
      patientId: 'pat-1',
      lotId: 'lot-1',
      locationId: 'loc-a',
      medicationAdministrationId: 'ma-1',
      fundingSource: 'vfc',
      vfcEligibility: 'V01',
      reason: 'Ordering error left this stock short',
      performerReference: 'Practitioner/nurse',
    });
  });

  it('writes nothing when the stock matches the eligibility, or when the dose is already logged', async () => {
    const matching = administration('Y0112');
    applyVaccineDoseFunding(matching, { fundingSource: 'vfc', vfcEligibility: 'V02' });
    const oystehr = mockOystehr();
    await recordVfcBorrowing(oystehr, matching, 'Practitioner/nurse');
    expect(oystehr.fhir.create).not.toHaveBeenCalled();

    const borrowed = administration('Y0112');
    applyVaccineDoseFunding(borrowed, { fundingSource: 'vfc', vfcEligibility: 'V01', borrowingReason: 'x' });
    const logged = mockOystehr([loggedRow()]);
    await recordVfcBorrowing(logged, borrowed, 'Practitioner/nurse');
    expect(logged.fhir.create).not.toHaveBeenCalled();
    expect(logged.fhir.update).not.toHaveBeenCalled();
    expect(logged.fhir.patch).not.toHaveBeenCalled();
  });

  it('a cancelled dose comes off the log: its row is entered in error', async () => {
    const cancelled = { ...administration('Y0112'), status: 'stopped' as const };
    applyVaccineDoseFunding(cancelled, { fundingSource: 'vfc', vfcEligibility: 'V01', borrowingReason: 'x' });
    const oystehr = mockOystehr([loggedRow()]);
    await recordVfcBorrowing(oystehr, cancelled, 'Practitioner/nurse');
    expect(calls(oystehr, 'patch')).toEqual([
      [
        {
          resourceType: 'Observation',
          id: 'existing',
          operations: [{ op: 'replace', path: '/status', value: 'entered-in-error' }],
        },
      ],
    ]);
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('a dose re-administered from the right stock after all comes off the log too', async () => {
    const matching = administration('Y0112');
    applyVaccineDoseFunding(matching, { fundingSource: 'vfc', vfcEligibility: 'V02' });
    const oystehr = mockOystehr([loggedRow()]);
    await recordVfcBorrowing(oystehr, matching, 'Practitioner/nurse');
    expect(calls(oystehr, 'patch')).toHaveLength(1);
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('a dose re-administered for another reason keeps its row, which follows', async () => {
    const borrowed = administration('Y0112');
    applyVaccineDoseFunding(borrowed, {
      fundingSource: 'vfc',
      vfcEligibility: 'V01',
      borrowingReason: 'Short-dated vaccine would expire unused',
    });
    const oystehr = mockOystehr([loggedRow('x')]);
    await recordVfcBorrowing(oystehr, borrowed, 'Practitioner/nurse-2');
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
    const [[updated]] = calls(oystehr, 'update') as [[Observation]];
    expect(parseVfcBorrowingObservation(updated)).toMatchObject({
      id: 'existing',
      lotId: 'lot-1',
      reason: 'Short-dated vaccine would expire unused',
      performerReference: 'Practitioner/nurse-2',
      effectiveDateTime: '2026-11-10T15:00:00.000Z',
    });
  });

  it('writes nothing for a typed lot that is not in stock', async () => {
    const ma = administration('TYPED-LOT');
    applyVaccineDoseFunding(ma, { fundingSource: 'vfc', vfcEligibility: 'V01', borrowingReason: 'x' });
    const oystehr = mockOystehr();
    await recordVfcBorrowing(oystehr, ma, 'Practitioner/nurse');
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });
});
