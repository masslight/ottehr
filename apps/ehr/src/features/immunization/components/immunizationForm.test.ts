import { DateTime } from 'luxon';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { MVX_MANUFACTURERS } from 'utils/lib/types/data/immunization/mvx-manufacturers.generated';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it } from 'vitest';
import {
  administrationErrors,
  administrationSummary,
  applyImmunizationQuickPick,
  emptyImmunizationForm,
  immunizationFormFromOrder,
  ImmunizationFormValues,
  immunizationOrderErrors,
  immunizationOrderRequest,
  immunizationQuickPickFrom,
  manufacturerBlank,
  mergeAdministeredDateTime,
  pickManufacturer,
  SAVED_MANUFACTURER,
} from './immunizationForm';

const TDAP = { id: '115', name: 'Tdap' };
const LEGACY_VACCINE = { id: 'a3f1c2d4-0000-4000-8000-000000000001', name: 'Tdap (Adacel/Boostrix)' };
const PROVIDER = { id: 'prov-1', name: 'Dr. Test' };
const MERCK = MVX_MANUFACTURERS.find((manufacturer) => manufacturer.mvx === 'MSD')!;

const form = (
  details: ImmunizationFormValues['details'] = {},
  administrationDetails: ImmunizationFormValues['administrationDetails'] = {}
): ImmunizationFormValues => {
  const empty = emptyImmunizationForm();
  return {
    details: { ...empty.details, ...details },
    administrationDetails: { ...empty.administrationDetails, ...administrationDetails },
  };
};

const ORDERABLE = { medication: TDAP, dose: '0.5', units: 'ml', orderedProvider: PROVIDER };
const ADMINISTRABLE = {
  administeredDateTime: '2026-11-10T09:30:00.000-05:00',
  lot: 'L-42',
  expDate: '2027-01-31',
  ndc: '58160-0842-11',
  mvx: 'SKB',
  visGivenDate: '2026-11-10',
};

describe('immunizationFormFromOrder', () => {
  const order: ImmunizationOrder = {
    id: 'order-1',
    status: 'pending',
    encounterId: 'enc-1',
    details: { ...ORDERABLE, orderedDateTime: '2026-11-09T10:00:00Z', manufacturer: 'Merck' },
    administrationDetails: {
      lot: 'L-42',
      expDate: '2027-01-31',
      mvx: 'MSD',
      cvx: '115',
      ndc: '00006-4681-00',
      administeredProvider: { id: '', name: '' },
      administeredDateTime: '',
      emergencyContact: { relationship: 'parent', fullName: 'Martin Black', mobile: '+12025550178' },
    },
  };

  it('keeps what the form edits and leaves out what the server works out itself', () => {
    const values = immunizationFormFromOrder(order);

    expect(values.details).toEqual({ ...ORDERABLE, manufacturer: 'Merck' });
    expect(values.administrationDetails).toMatchObject({ lot: 'L-42', mvx: 'MSD', ndc: '00006-4681-00' });
    expect(values.administrationDetails).not.toHaveProperty('cvx');
    expect(values.administrationDetails).not.toHaveProperty('administeredProvider');
    expect(values.administrationDetails).not.toHaveProperty('emergencyContact');
  });

  it('gives an order without administration details empty ones', () => {
    expect(immunizationFormFromOrder({ ...order, administrationDetails: undefined }).administrationDetails).toEqual(
      emptyImmunizationForm().administrationDetails
    );
  });
});

describe('applyImmunizationQuickPick', () => {
  const quickPick: ImmunizationQuickPickData = {
    name: 'Tdap adult',
    vaccine: TDAP,
    dose: '0.5',
    units: 'ml',
    route: '78421000',
    location: { code: '368208006', name: 'Left Deltoid' },
    manufacturer: 'GlaxoSmithKline',
    instructions: 'After consent',
    cvx: '999',
    mvx: 'SKB',
    cptCodes: [{ code: '90715', display: 'Tdap' }],
    ndc: '58160-0842-11',
    lot: 'L-42',
    expDate: '2027-01-31',
  };

  it('fills the order and the administration details on the order page', () => {
    const values = applyImmunizationQuickPick(form({ orderedProvider: PROVIDER }), quickPick, true);

    expect(values.details).toEqual({
      orderedProvider: PROVIDER,
      medication: TDAP,
      dose: '0.5',
      units: 'ml',
      route: '78421000',
      location: { code: '368208006', name: 'Left Deltoid' },
      manufacturer: 'GlaxoSmithKline',
      instructions: 'After consent',
    });
    expect(values.administrationDetails).toMatchObject({
      lot: 'L-42',
      expDate: '2027-01-31',
      mvx: 'SKB',
      ndc: '58160-0842-11',
      cptCodes: [{ code: '90715', display: 'Tdap' }],
    });
    // the CVX code is the vaccine's, recorded by the server: the quick pick's is not applied
    expect(values.administrationDetails).not.toHaveProperty('cvx');
  });

  it('leaves the vaccine to pick when the quick pick was saved against a vaccine that is not in the list', () => {
    const values = applyImmunizationQuickPick(form(), { ...quickPick, vaccine: LEGACY_VACCINE }, true);

    expect(values.details.medication).toBeUndefined();
    expect(values.details.dose).toBe('0.5');
  });

  it('fills only what is recorded at administration on an order already placed', () => {
    const placed = form({ ...ORDERABLE, dose: '1', instructions: 'Ordered instructions' }, { lot: 'OLD' });

    const values = applyImmunizationQuickPick(placed, { ...quickPick, vaccine: { id: '03', name: 'MMR' } }, false);

    expect(values.details).toEqual({
      ...ORDERABLE,
      dose: '1',
      instructions: 'Ordered instructions',
      manufacturer: 'GlaxoSmithKline',
    });
    expect(values.administrationDetails).toMatchObject({ lot: 'L-42', expDate: '2027-01-31', mvx: 'SKB' });
  });

  it('clears the administration details a quick pick does not have', () => {
    const values = applyImmunizationQuickPick(
      form(ORDERABLE, { lot: 'OLD', cptCodes: [{ code: '90471', display: 'admin' }] }),
      { name: 'Bare', vaccine: TDAP },
      true
    );

    expect(values.administrationDetails.lot).toBeUndefined();
    expect(values.administrationDetails.cptCodes).toEqual([]);
  });
});

describe('immunizationQuickPickFrom', () => {
  it('saves the vaccine CVX code and the picked manufacturer with its MVX code', () => {
    const quickPick = immunizationQuickPickFrom(
      form({ ...ORDERABLE, manufacturer: MERCK.name }, { mvx: MERCK.mvx, lot: 'L-42', ndc: '00006-4681-00' }),
      'Tdap adult'
    );

    expect(quickPick).toMatchObject({
      name: 'Tdap adult',
      vaccine: TDAP,
      dose: '0.5',
      units: 'ml',
      cvx: '115',
      manufacturer: MERCK.name,
      mvx: 'MSD',
      lot: 'L-42',
      ndc: '00006-4681-00',
    });
  });

  it('saves no CVX code for a vaccine that is not in the list', () => {
    expect(immunizationQuickPickFrom(form({ medication: LEGACY_VACCINE }), 'Old').cvx).toBeUndefined();
  });
});

describe('immunizationOrderErrors', () => {
  it('asks for the immunization, the dose, the units and the ordering provider', () => {
    expect(immunizationOrderErrors(form())).toEqual([
      'Pick the immunization',
      'Enter the dose',
      'Pick the units',
      'Pick the ordering provider',
    ]);
  });

  it('accepts an order with those and nothing else', () => {
    expect(immunizationOrderErrors(form(ORDERABLE))).toEqual([]);
  });

  it.each(['0', '-1', 'abc'])('rejects the dose "%s"', (dose) => {
    expect(immunizationOrderErrors(form({ ...ORDERABLE, dose }))).toEqual(['Dose must be positive']);
  });
});

describe('administrationErrors', () => {
  it('asks for when it was given, the lot, its expiry and NDC, the manufacturer and the VIS date', () => {
    expect(administrationErrors(form(ORDERABLE), undefined)).toEqual([
      'Enter the date and time given',
      'Enter the lot number',
      'Enter the expiration date',
      'Enter the NDC code',
      'Pick the manufacturer from the list',
      'Enter the date the VIS was given',
    ]);
  });

  it('asks for nothing more once those are filled: CPT codes are optional', () => {
    expect(administrationErrors(form(ORDERABLE, ADMINISTRABLE), undefined)).toEqual([]);
  });

  it('treats a whitespace-only lot or NDC as missing', () => {
    expect(administrationErrors(form(ORDERABLE, { ...ADMINISTRABLE, lot: '  ', ndc: ' ' }), undefined)).toEqual([
      'Enter the lot number',
      'Enter the NDC code',
    ]);
  });

  it('needs an MVX code: a manufacturer name typed before the list is not enough', () => {
    const typedName = form({ ...ORDERABLE, manufacturer: 'Some Pharma' }, { ...ADMINISTRABLE, mvx: '' });

    expect(administrationErrors(typedName, undefined)).toEqual(['Pick the manufacturer from the list']);
  });

  it('accepts an MVX code typed before the list', () => {
    expect(administrationErrors(form(ORDERABLE, { ...ADMINISTRABLE, mvx: '1111fff' }), undefined)).toEqual([]);
  });

  it('asks for a list vaccine when the order was placed before the list and has no CVX code', () => {
    const legacy = form({ ...ORDERABLE, medication: LEGACY_VACCINE }, ADMINISTRABLE);

    expect(administrationErrors(legacy, undefined)).toEqual([
      'Pick the immunization from the list: this one has no CVX code',
    ]);
    expect(administrationErrors(legacy, ' ')).toHaveLength(1);
    expect(administrationErrors(legacy, '140')).toEqual([]);
  });
});

describe('immunizationOrderRequest', () => {
  it('sends the filled values and leaves the empty ones out', () => {
    const request = immunizationOrderRequest(
      form({ ...ORDERABLE, route: '', instructions: '' }, { lot: 'L-42' }),
      'enc-1'
    );

    expect(request).toEqual({
      encounterId: 'enc-1',
      orderId: undefined,
      details: ORDERABLE,
      administrationDetails: { lot: 'L-42' },
    });
  });

  it('always sends administration details, so clearing them on an edit clears them on the order', () => {
    expect(immunizationOrderRequest(form(ORDERABLE), 'enc-1', 'order-1')).toMatchObject({
      orderId: 'order-1',
      administrationDetails: {},
    });
  });
});

describe('mergeAdministeredDateTime', () => {
  const now = DateTime.fromISO('2026-11-19T21:24:37.123');

  it('gives a date picked first the current time', () => {
    const merged = mergeAdministeredDateTime(undefined, DateTime.fromISO('2026-11-11T00:00:00'), 'date', now);

    expect(DateTime.fromISO(merged!).toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS")).toBe('2026-11-11T21:24:00.000');
  });

  it('gives a time picked first the current date', () => {
    const merged = mergeAdministeredDateTime(undefined, DateTime.fromISO('2020-01-01T08:15:59'), 'time', now);

    expect(DateTime.fromISO(merged!).toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS")).toBe('2026-11-19T08:15:00.000');
  });

  it('reads the picked date and time as they show, whatever zone the picker hands them in', () => {
    const pickedElsewhere = DateTime.fromISO('2026-11-11T00:00:00', { zone: 'Pacific/Auckland' });

    const merged = mergeAdministeredDateTime(undefined, pickedElsewhere, 'date', now);

    expect(DateTime.fromISO(merged!).toFormat("yyyy-MM-dd'T'HH:mm")).toBe('2026-11-11T21:24');
  });

  it('changes only the date when the date blank changes', () => {
    const merged = mergeAdministeredDateTime(
      DateTime.fromISO('2026-11-19T08:15:00').toISO()!,
      DateTime.fromISO('2026-11-11T00:00:00'),
      'date',
      now
    );

    expect(DateTime.fromISO(merged!).toFormat("yyyy-MM-dd'T'HH:mm")).toBe('2026-11-11T08:15');
  });

  it('changes only the time when the time blank changes', () => {
    const merged = mergeAdministeredDateTime(
      DateTime.fromISO('2026-11-11T08:15:00').toISO()!,
      DateTime.fromISO('2026-11-19T22:40:00'),
      'time',
      now
    );

    expect(DateTime.fromISO(merged!).toFormat("yyyy-MM-dd'T'HH:mm")).toBe('2026-11-11T22:40');
  });

  it('keeps what is saved while a year is still being typed', () => {
    const saved = DateTime.fromISO('2026-11-11T08:15:00').toISO()!;

    expect(mergeAdministeredDateTime(saved, DateTime.fromISO('0202-11-11T00:00:00'), 'date', now)).toBe(saved);
  });

  it('is empty once a blank is cleared', () => {
    const saved = DateTime.fromISO('2026-11-11T08:15:00').toISO()!;

    expect(mergeAdministeredDateTime(saved, null, 'date', now)).toBeUndefined();
    expect(mergeAdministeredDateTime(saved, DateTime.invalid('typing'), 'time', now)).toBeUndefined();
  });
});

describe('manufacturerBlank', () => {
  const listOptions = MVX_MANUFACTURERS.map((manufacturer) => ({ value: manufacturer.mvx, label: manufacturer.name }));

  it('offers the MVX list, by manufacturer name', () => {
    expect(manufacturerBlank(form())).toEqual({ value: undefined, label: undefined, options: listOptions });
    expect(listOptions).toHaveLength(36);
  });

  it('shows a manufacturer picked from the list by its name', () => {
    const picked = { value: 'MSD', label: MERCK.name, options: listOptions };

    expect(manufacturerBlank(form({ manufacturer: MERCK.name }, { mvx: 'MSD' }))).toEqual(picked);
    // an MVX code alone, as a quick pick may hold it
    expect(manufacturerBlank(form({}, { mvx: 'MSD' }))).toEqual(picked);
  });

  it.each([
    ['a typed name without a code', { manufacturer: 'Some Pharma' }, { mvx: '' }, 'Some Pharma'],
    ['a typed code the list does not have', {}, { mvx: '1111fff' }, 'MVX 1111fff'],
    ['a typed name and code', { manufacturer: 'example' }, { mvx: '1111fff' }, 'example (MVX 1111fff)'],
    ['a typed name next to a code of the list', { manufacturer: 'Merck' }, { mvx: 'MSD' }, 'Merck (MVX MSD)'],
  ])('offers %s first, as it was saved, and keeps it picked', (_case, details, administrationDetails, label) => {
    const blank = manufacturerBlank(form(details, administrationDetails));

    expect(blank).toEqual({
      value: SAVED_MANUFACTURER,
      label,
      options: [{ value: SAVED_MANUFACTURER, label }, ...listOptions],
    });
  });
});

describe('pickManufacturer', () => {
  const typed = form({ manufacturer: 'example' }, { mvx: '1111fff', lot: 'L-42' });

  it('sets the name and the MVX code of the picked manufacturer together', () => {
    const picked = pickManufacturer(typed, 'MSD');

    expect(picked.details.manufacturer).toBe(MERCK.name);
    expect(picked.administrationDetails).toMatchObject({ mvx: 'MSD', lot: 'L-42' });
  });

  it('clears both', () => {
    const cleared = pickManufacturer(typed, undefined);

    expect(cleared.details.manufacturer).toBe('');
    expect(cleared.administrationDetails.mvx).toBe('');
  });

  it('leaves a manufacturer saved before the list as it is when it is picked again', () => {
    expect(pickManufacturer(typed, SAVED_MANUFACTURER)).toBe(typed);
  });
});

describe('administrationSummary', () => {
  it('is empty for a form with no administration details', () => {
    expect(administrationSummary(form(ORDERABLE))).toEqual([]);
  });

  it('lists what is filled, in the order of the sentences', () => {
    const values = form(
      { ...ORDERABLE, manufacturer: MERCK.name },
      {
        ...ADMINISTRABLE,
        mvx: 'MSD',
        cptCodes: [
          { code: '90715', display: 'Tdap' },
          { code: '90471', display: 'admin' },
        ],
      }
    );

    expect(administrationSummary(values)).toEqual([
      `Given ${DateTime.fromISO(ADMINISTRABLE.administeredDateTime).toLocaleString(DateTime.DATETIME_MED)}`,
      'Lot L-42',
      `expires ${DateTime.fromISO('2027-01-31').toLocaleString(DateTime.DATE_MED)}`,
      'NDC 58160-0842-11',
      MERCK.name,
      `VIS given ${DateTime.fromISO('2026-11-10').toLocaleString(DateTime.DATE_MED)}`,
      'CPT 90715, 90471',
    ]);
  });

  it('names a manufacturer saved before the list as it was saved', () => {
    expect(administrationSummary(form({ manufacturer: 'example' }, { mvx: '1111fff' }))).toEqual([
      'example (MVX 1111fff)',
    ]);
  });
});
