import { ChargeItemDefinition } from 'fhir/r4b';
import { CPT_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { ChargeItemDefinitionDefault } from 'utils/lib/types/data/billing/billing.types';
import { EXTENSION_URL_CPT_MODIFIER } from 'utils/lib/helpers/rcm/constants';
import { describe, expect, it } from 'vitest';
import {
  activeDefaultChargeMasterSearchParams,
  chargeItemDefinitionTypeSearchParam,
  getChargeMasterPrice,
  selectBestChargeMaster,
} from '../../../src/billing/charge-master.helpers';
import { CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, CHARGE_ITEM_DEFINITION_TYPE_SYSTEM } from '../../../src/billing/shared';

interface PriceEntry {
  code: string;
  amount: number;
  modifier?: string;
}

const makeChargeMaster = ({
  kind,
  date,
  prices,
  status = 'active',
  title,
}: {
  kind?: ChargeItemDefinitionDefault;
  date?: string;
  prices: PriceEntry[];
  status?: ChargeItemDefinition['status'];
  title?: string;
}): ChargeItemDefinition => ({
  resourceType: 'ChargeItemDefinition',
  url: `urn:uuid:charge-master:${title ?? kind ?? 'test'}`,
  title: title ?? `${kind ?? 'test'} charge master`,
  status,
  date,
  meta: kind ? { tag: [{ system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: kind }] } : undefined,
  propertyGroup: prices.map((price) => ({
    priceComponent: [
      {
        type: 'base' as const,
        code: { coding: [{ system: CPT_CODE_SYSTEM, code: price.code }] },
        amount: { value: price.amount, currency: 'USD' },
        ...(price.modifier ? { extension: [{ url: EXTENSION_URL_CPT_MODIFIER, valueCode: price.modifier }] } : {}),
      },
    ],
  })),
});

describe('getChargeMasterPrice', () => {
  const chargeMaster = makeChargeMaster({
    prices: [
      { code: '99213', amount: 150 },
      { code: '99214', amount: 250, modifier: '25' },
      { code: '99214', amount: 200 },
    ],
  });

  it('prices a modifier-less code from the modifier-less entry', () => {
    expect(getChargeMasterPrice(chargeMaster, '99213', [])).toBe(150);
    // Skips the modifier-25 entry even though it appears first for the code.
    expect(getChargeMasterPrice(chargeMaster, '99214', [])).toBe(200);
  });

  it('prices a code with modifiers from the entry matching one of them', () => {
    expect(getChargeMasterPrice(chargeMaster, '99214', ['25'])).toBe(250);
    expect(getChargeMasterPrice(chargeMaster, '99214', ['59', '25'])).toBe(250);
  });

  it('never crosses modifier boundaries: a modifier line needs a modifier entry and vice versa', () => {
    // 99213 has only a modifier-less entry; a modifier-25 line must not use it.
    expect(getChargeMasterPrice(chargeMaster, '99213', ['25'])).toBeUndefined();
    // A code priced only with a modifier never applies to a modifier-less line.
    const modifierOnly = makeChargeMaster({ prices: [{ code: '99213', amount: 80, modifier: '25' }] });
    expect(getChargeMasterPrice(modifierOnly, '99213', [])).toBeUndefined();
    expect(getChargeMasterPrice(modifierOnly, '99213', ['25'])).toBe(80);
  });

  it('returns undefined for unknown codes and ignores non-base or code-less entries', () => {
    expect(getChargeMasterPrice(chargeMaster, '00000', [])).toBeUndefined();
    const malformed: ChargeItemDefinition = {
      resourceType: 'ChargeItemDefinition',
      url: 'urn:uuid:charge-master:malformed',
      status: 'active',
      propertyGroup: [
        { priceComponent: [{ type: 'surcharge', amount: { value: 5, currency: 'USD' } }] },
        { priceComponent: [{ type: 'base', amount: { value: 7, currency: 'USD' } }] },
      ],
    };
    expect(getChargeMasterPrice(malformed, '99213', [])).toBeUndefined();
  });

  it('resolves ties to the first matching entry', () => {
    const duplicated = makeChargeMaster({
      prices: [
        { code: '99213', amount: 111 },
        { code: '99213', amount: 222 },
      ],
    });
    expect(getChargeMasterPrice(duplicated, '99213', [])).toBe(111);
  });
});

describe('selectBestChargeMaster', () => {
  const candidates: ChargeItemDefinition[] = [
    makeChargeMaster({ kind: 'insurance', date: '2025-01-01', prices: [], title: 'ins-2025' }),
    makeChargeMaster({ kind: 'insurance', date: '2026-01-01', prices: [], title: 'ins-2026' }),
    makeChargeMaster({ kind: 'insurance', date: '2026-02-01', prices: [], title: 'ins-future' }),
    makeChargeMaster({ kind: 'insurance', date: '2026-01-04', prices: [], title: 'ins-retired', status: 'retired' }),
    makeChargeMaster({ kind: 'self-pay', date: '2026-01-02', prices: [], title: 'self-pay-2026' }),
    makeChargeMaster({ date: '2026-01-03', prices: [], title: 'undesignated' }),
  ];

  it('picks the most recent active default effective on or before the date of service', () => {
    expect(selectBestChargeMaster(candidates, 'insurance', '2026-01-05')?.title).toBe('ins-2026');
    expect(selectBestChargeMaster(candidates, 'self-pay', '2026-01-05')?.title).toBe('self-pay-2026');
    // Earlier DOS: only the 2025 insurance charge master is effective yet.
    expect(selectBestChargeMaster(candidates, 'insurance', '2025-06-01')?.title).toBe('ins-2025');
  });

  it('returns undefined when nothing is designated, effective, and active', () => {
    expect(selectBestChargeMaster(candidates, 'insurance', '2024-12-31')).toBeUndefined();
    expect(selectBestChargeMaster([], 'insurance', '2026-01-05')).toBeUndefined();
    const undated = makeChargeMaster({ kind: 'insurance', prices: [], title: 'undated' });
    expect(selectBestChargeMaster([undated], 'insurance', '2026-01-05')).toBeUndefined();
  });

  it('treats a charge master effective ON the date of service as applicable, even with a dateTime', () => {
    const sameDay = makeChargeMaster({
      kind: 'insurance',
      date: '2026-01-05T10:30:00Z',
      prices: [],
      title: 'same-day',
    });
    expect(selectBestChargeMaster([sameDay], 'insurance', '2026-01-05')?.title).toBe('same-day');
  });
});

describe('charge master search params', () => {
  it('builds the identity filter the charge master screen lists by', () => {
    expect(chargeItemDefinitionTypeSearchParam('charge-master')).toEqual({
      name: '_tag',
      value: `${CHARGE_ITEM_DEFINITION_TYPE_SYSTEM}|charge-master`,
    });
    expect(chargeItemDefinitionTypeSearchParam('fee-schedule')).toEqual({
      name: '_tag',
      value: `${CHARGE_ITEM_DEFINITION_TYPE_SYSTEM}|fee-schedule`,
    });
  });

  it('scopes pricing candidates to active, default-designated charge masters on the same identity', () => {
    expect(activeDefaultChargeMasterSearchParams(['insurance', 'self-pay'])).toEqual([
      chargeItemDefinitionTypeSearchParam('charge-master'),
      { name: 'status', value: 'active' },
      {
        name: '_tag',
        value: `${CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM}|insurance,${CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM}|self-pay`,
      },
    ]);
    expect(activeDefaultChargeMasterSearchParams(['self-pay'])[2]).toEqual({
      name: '_tag',
      value: `${CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM}|self-pay`,
    });
  });
});
