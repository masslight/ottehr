import { ChargeItemDefinition } from 'fhir/r4b';
import { CPT_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { buildLineItems } from '../../src/components/PatientPaymentsList';

const feeSchedule: ChargeItemDefinition = {
  resourceType: 'ChargeItemDefinition',
  status: 'active',
  url: 'https://example.com/fee-schedule',
  propertyGroup: [
    {
      priceComponent: [
        {
          type: 'base',
          code: { coding: [{ system: CPT_CODE_SYSTEM, code: 'J0171', display: 'Adrenalin epinephrine inject' }] },
          amount: { value: 25 },
        },
      ],
    },
    {
      priceComponent: [
        {
          type: 'base',
          code: { coding: [{ system: CPT_CODE_SYSTEM, code: '99213', display: 'Office visit' }] },
          amount: { value: 150 },
        },
      ],
    },
  ],
};

describe('buildLineItems', () => {
  it('multiplies the fee by billableUnits for administered medications', () => {
    const items = buildLineItems(
      feeSchedule,
      [{ code: 'J0171', display: 'Adrenalin epinephrine inject', billableUnits: 3 }],
      { code: '99213', display: 'Office visit' }
    );

    expect(items).toEqual([
      expect.objectContaining({ code: 'J0171', amount: 75, units: 3 }),
      expect.objectContaining({ code: '99213', amount: 150, units: 1 }),
    ]);
  });

  it('defaults to 1 unit when billableUnits is missing or invalid', () => {
    const items = buildLineItems(
      feeSchedule,
      [
        { code: 'J0171', display: 'A' },
        { code: 'J0171', display: 'B', billableUnits: 0 },
        { code: 'J0171', display: 'C', billableUnits: NaN },
      ],
      undefined
    );

    expect(items.map((i) => i.amount)).toEqual([25, 25, 25]);
    expect(items.map((i) => i.units)).toEqual([1, 1, 1]);
  });

  it('applies units to codes missing from the fee schedule (fee unknown)', () => {
    const items = buildLineItems(feeSchedule, [{ code: 'J9999', display: 'Unknown', billableUnits: 4 }], undefined);

    expect(items).toEqual([expect.objectContaining({ code: 'J9999', amount: 0, units: 4, feeUnknown: true })]);
  });
});
