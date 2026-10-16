import { DmeMenuItem } from 'utils/lib/types/api/dme.types';
import { describe, expect, it } from 'vitest';
import { applyDmeQuickPick, buildDmeQuickPick, DmeOrderFormValues, OTHER_ITEM_OPTION } from './dmeQuickPick';

const KNEE_BRACE: DmeMenuItem = {
  id: 'knee-brace',
  name: 'Knee brace',
  hcpcsCodes: [{ code: 'L1830', display: 'Knee orthosis' }],
};
const CRUTCHES: DmeMenuItem = {
  id: 'crutches',
  name: 'Crutches',
  hcpcsCodes: [{ code: 'E0114', display: 'Crutches' }],
};
const MENU = [KNEE_BRACE, CRUTCHES];

const emptyValues = (overrides: Partial<DmeOrderFormValues> = {}): DmeOrderFormValues => ({
  item: null,
  otherItemName: '',
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
  it('resolves the menu item by id and fills every field the pick defines', () => {
    const patch = applyDmeQuickPick(
      emptyValues(),
      {
        name: 'Knee brace, right',
        menuItemId: 'knee-brace',
        itemName: 'Old knee brace name',
        quantity: 2,
        billingCodes: [{ code: 'L1810', display: 'Knee orthosis, elastic' }],
        laterality: 'RT',
        modifier: 'NU',
        duration: { value: 3, unit: 'weeks' },
        instructions: 'Wear while walking',
        external: true,
        thirdParty: { name: 'Acme Medical Supply', fax: '5551234567' },
      },
      MENU
    );

    expect(patch).toEqual({
      item: KNEE_BRACE,
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

  it('takes the menu item codes when the pick has none', () => {
    const patch = applyDmeQuickPick(emptyValues(), { name: 'Crutches', menuItemId: 'crutches' }, MENU);

    expect(patch).toEqual({ item: CRUTCHES, billingCodes: [{ code: 'E0114', display: 'Crutches' }] });
  });

  it('keeps edited codes when the pick re-selects the current item without codes', () => {
    const editedCodes = [{ code: 'E0110', display: 'Forearm crutches' }];
    const patch = applyDmeQuickPick(
      emptyValues({ item: CRUTCHES, billingCodes: editedCodes }),
      { name: 'Crutches', menuItemId: 'crutches' },
      MENU
    );

    expect(patch.billingCodes).toBeUndefined();
  });

  it('applies an explicitly empty code list', () => {
    const patch = applyDmeQuickPick(
      emptyValues(),
      { name: 'Crutches', menuItemId: 'crutches', billingCodes: [] },
      MENU
    );

    expect(patch.billingCodes).toEqual([]);
  });

  it('falls back to a menu item with the same name when the id is gone', () => {
    const patch = applyDmeQuickPick(
      emptyValues(),
      { name: 'Knee brace', menuItemId: 'deleted-id', itemName: 'knee brace' },
      MENU
    );

    expect(patch.item).toEqual(KNEE_BRACE);
  });

  it('falls back to "Other" with the saved name when the item is not on the menu', () => {
    const patch = applyDmeQuickPick(
      emptyValues(),
      { name: 'Collar', menuItemId: 'deleted-id', itemName: 'Cervical collar' },
      MENU
    );

    expect(patch).toEqual({ item: OTHER_ITEM_OPTION, otherItemName: 'Cervical collar', billingCodes: [] });
  });

  it('leaves fields the pick does not define, the ordering provider and the diagnoses alone', () => {
    const patch = applyDmeQuickPick(
      emptyValues({ item: KNEE_BRACE, laterality: 'LT' }),
      { name: 'Two units', quantity: 2 },
      MENU
    );

    expect(patch).toEqual({ quantity: '2' });
  });

  it('does not fill third party information for an in-house pick', () => {
    const patch = applyDmeQuickPick(
      emptyValues({ external: true }),
      { name: 'In house', external: false, thirdParty: { name: 'Acme' } },
      MENU
    );

    expect(patch).toEqual({ external: false });
  });
});

describe('buildDmeQuickPick', () => {
  it('stores the menu item with a name snapshot and the filled fields', () => {
    const quickPick = buildDmeQuickPick(
      emptyValues({
        item: KNEE_BRACE,
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
      menuItemId: 'knee-brace',
      itemName: 'Knee brace',
      quantity: 2,
      billingCodes: [{ code: 'L1830', display: 'Knee orthosis' }],
      laterality: 'RT',
      modifier: 'RR',
      duration: { value: 10, unit: 'days' },
      instructions: 'Wear while walking',
      external: true,
      thirdParty: { name: 'Acme Medical Supply', phone: '5559876543' },
    });
  });

  it('omits empty fields and third party information of an in-house order', () => {
    const quickPick = buildDmeQuickPick(
      emptyValues({
        quantity: '',
        durationValue: '',
        durationUnit: 'weeks',
        thirdParty: { name: 'Acme', address: '', phone: '', fax: '' },
      }),
      'Blank'
    );

    expect(quickPick).toStrictEqual({ name: 'Blank', external: false });
  });

  it('stores an "Other" item by name only and keeps its empty code list', () => {
    const quickPick = buildDmeQuickPick(
      emptyValues({ item: OTHER_ITEM_OPTION, otherItemName: ' Cervical collar ' }),
      'Collar'
    );

    expect(quickPick).toStrictEqual({
      name: 'Collar',
      itemName: 'Cervical collar',
      quantity: 1,
      billingCodes: [],
      external: false,
    });
  });

  it('round-trips through apply', () => {
    const values = emptyValues({
      item: CRUTCHES,
      quantity: '2',
      laterality: 'BI',
      billingCodes: [{ code: 'E0114', display: 'Crutches' }],
    });

    const patch = applyDmeQuickPick(emptyValues(), { id: 'qp-1', ...buildDmeQuickPick(values, 'Crutches') }, MENU);

    expect({ ...emptyValues(), ...patch }).toEqual({ ...values, orderedBy: emptyValues().orderedBy });
  });
});
