import { DmeQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { describe, expect, it } from 'vitest';
import { applyDmeQuickPick, buildDmeQuickPick, DmeOrderFormValues } from './dmeQuickPick';

const emptyValues = (overrides: Partial<DmeOrderFormValues> = {}): DmeOrderFormValues => ({
  itemName: '',
  diagnoses: [],
  quantity: '1',
  laterality: null,
  modifier: null,
  durationValue: '',
  durationUnit: 'days',
  orderedBy: { id: 'practitioner-1', name: 'Dr. Ordering' },
  instructions: '',
  billingCodes: [],
  external: false,
  thirdParty: { name: '', address: '', phone: '', fax: '' },
  ...overrides,
});

describe('applyDmeQuickPick', () => {
  it('sets the DME name and codes and fills every field the pick defines', () => {
    const patch = applyDmeQuickPick({
      name: 'Knee brace, right',
      itemName: 'Knee brace',
      quantity: 2,
      billingCodes: [{ code: 'L1810', display: 'Knee orthosis, elastic' }],
      laterality: 'RT',
      modifier: 'NU',
      duration: { value: 3, unit: 'weeks' },
      instructions: 'Wear while walking',
      external: true,
      thirdParty: { name: 'Acme Medical Supply', fax: '5551234567' },
    });

    expect(patch).toEqual({
      itemName: 'Knee brace',
      billingCodes: [{ code: 'L1810', display: 'Knee orthosis, elastic' }],
      quantity: '2',
      laterality: 'RT',
      modifier: 'NU',
      durationValue: '3',
      durationUnit: 'weeks',
      instructions: 'Wear while walking',
      external: true,
      thirdParty: { name: 'Acme Medical Supply', address: '', phone: '', fax: '5551234567' },
    });
  });

  it('replaces the form codes with the pick codes, clearing them when the pick has none', () => {
    expect(applyDmeQuickPick({ name: 'Crutches', itemName: 'Crutches', billingCodes: [] }).billingCodes).toEqual([]);
    expect(applyDmeQuickPick({ name: 'Crutches', itemName: 'Crutches' }).billingCodes).toEqual([]);
  });

  it('ignores a menuItemId left on a pick saved before the DME menu was removed', () => {
    const legacy = { name: 'Crutches', itemName: 'Crutches', menuItemId: 'crutches' } as DmeQuickPickData;

    expect(applyDmeQuickPick(legacy)).toEqual({ itemName: 'Crutches', billingCodes: [] });
  });

  it('keeps the current DME name when a pick has none', () => {
    const patch = applyDmeQuickPick({ name: 'Two units', itemName: '  ', quantity: 2 });

    expect(patch).toEqual({ billingCodes: [], quantity: '2' });
  });

  it('does not fill third party information for an in-house pick', () => {
    const patch = applyDmeQuickPick({
      name: 'In house',
      itemName: 'Sling',
      external: false,
      thirdParty: { name: 'Acme' },
    });

    expect(patch).toEqual({ itemName: 'Sling', billingCodes: [], external: false });
  });
});

describe('buildDmeQuickPick', () => {
  it('stores the DME name, codes and the filled fields', () => {
    const quickPick = buildDmeQuickPick(
      emptyValues({
        itemName: ' Knee brace ',
        diagnoses: [{ code: 'M25.561', display: 'Pain in right knee' }],
        quantity: '2',
        laterality: 'RT',
        modifier: 'RR',
        durationValue: '10',
        durationUnit: 'days',
        instructions: '  Wear while walking  ',
        billingCodes: [{ code: 'L1830', display: 'Knee orthosis', resourceId: 'charge-item-1' }],
        external: true,
        thirdParty: { name: ' Acme Medical Supply ', address: '', phone: '5559876543', fax: '' },
      }),
      '  Knee brace, right '
    );

    expect(quickPick).toStrictEqual({
      name: 'Knee brace, right',
      itemName: 'Knee brace',
      billingCodes: [{ code: 'L1830', display: 'Knee orthosis' }],
      quantity: 2,
      laterality: 'RT',
      modifier: 'RR',
      duration: { value: 10, unit: 'days' },
      instructions: 'Wear while walking',
      external: true,
      thirdParty: { name: 'Acme Medical Supply', phone: '5559876543' },
    });
  });

  it('omits empty optional fields and third party information of an in-house order', () => {
    const quickPick = buildDmeQuickPick(
      emptyValues({
        itemName: 'Cervical collar',
        quantity: '',
        durationValue: '',
        durationUnit: 'weeks',
        thirdParty: { name: 'Acme', address: '', phone: '', fax: '' },
      }),
      'Collar'
    );

    expect(quickPick).toStrictEqual({ name: 'Collar', itemName: 'Cervical collar', billingCodes: [], external: false });
  });

  it('round-trips through apply', () => {
    const values = emptyValues({
      itemName: 'Crutches',
      quantity: '2',
      laterality: 'BI',
      billingCodes: [{ code: 'E0114', display: 'Crutches' }],
    });

    const patch = applyDmeQuickPick({ id: 'qp-1', ...buildDmeQuickPick(values, 'Crutches') });

    expect({ ...emptyValues(), ...patch }).toEqual(values);
  });
});
