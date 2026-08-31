import { Coverage, ServiceRequest } from 'fhir/r4b';
import { paymentMethodFromCoverage } from 'utils/lib/helpers/labs/helpers';
import { LAB_CLIENT_BILL_COVERAGE_TYPE_CODING } from 'utils/lib/types/data/labs/labs.constants';
import { LabPaymentMethod } from 'utils/lib/types/data/labs/labs.types';
import { describe, expect, test } from 'vitest';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCoverage = (id: string, typeCodes: string[]): Coverage => ({
  resourceType: 'Coverage',
  id,
  status: 'active',
  beneficiary: { reference: 'Patient/pat-1' },
  payor: [],
  type: {
    coding: typeCodes.map((code) => ({ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code })),
  },
});

const makeClientBillCoverage = (id = 'cov-cb'): Coverage => ({
  resourceType: 'Coverage',
  id,
  status: 'active',
  beneficiary: { reference: 'Patient/pat-1' },
  payor: [],
  type: { coding: [LAB_CLIENT_BILL_COVERAGE_TYPE_CODING] },
});

const makeSr = (coverageIds: string[]): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id: 'sr-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/pat-1' },
  insurance: coverageIds.map((id) => ({ reference: `Coverage/${id}` })),
});

// ---------------------------------------------------------------------------
// paymentMethodFromCoverage
// ---------------------------------------------------------------------------

describe('paymentMethodFromCoverage', () => {
  test('returns ClientBill for a client-bill coded coverage', () => {
    expect(paymentMethodFromCoverage(makeClientBillCoverage())).toBe(LabPaymentMethod.ClientBill);
  });

  test('returns SelfPay for a "pay" coded coverage', () => {
    expect(paymentMethodFromCoverage(makeCoverage('cov-sp', ['pay']))).toBe(LabPaymentMethod.SelfPay);
  });

  test('returns WorkersComp for a "WC" coded coverage', () => {
    expect(paymentMethodFromCoverage(makeCoverage('cov-wc', ['WC']))).toBe(LabPaymentMethod.WorkersComp);
  });

  test('returns Insurance when no recognized type code is present', () => {
    expect(paymentMethodFromCoverage(makeCoverage('cov-ins', ['EHCPOL']))).toBe(LabPaymentMethod.Insurance);
  });

  test('returns Insurance when coverage has no type coding at all', () => {
    const cov: Coverage = { resourceType: 'Coverage', status: 'active', beneficiary: {}, payor: [] };
    expect(paymentMethodFromCoverage(cov)).toBe(LabPaymentMethod.Insurance);
  });

  test('WC wins even when paired with other codes', () => {
    expect(paymentMethodFromCoverage(makeCoverage('cov-wc-pay', ['pay', 'WC']))).toBe(LabPaymentMethod.WorkersComp);
  });

  test('SelfPay wins over Insurance when both codes are present', () => {
    expect(paymentMethodFromCoverage(makeCoverage('cov-sp-ins', ['pay', 'EHCPOL']))).toBe(LabPaymentMethod.SelfPay);
  });
});

// ---------------------------------------------------------------------------
// billingType derivation: CPT codes only relevant for ClientBill orders
//
// The business rule: CPT codes are only saved at order-creation time when the
// payment method is ClientBill. hasCptCodes therefore only matters for
// ClientBill orders when deciding whether to show a billing warning. The tests
// below confirm paymentMethodFromCoverage returns the correct type so the
// assessment-card condition `!o.hasCptCodes && o.billingType === ClientBill`
// behaves correctly.
// ---------------------------------------------------------------------------

describe('billingType derivation from Coverage on ServiceRequest', () => {
  test('a ClientBill SR paired with its coverage resolves to ClientBill', () => {
    const sr = makeSr(['cov-cb']);
    const coverages = [makeClientBillCoverage('cov-cb')];
    const matched = coverages.filter((c) => sr.insurance?.some((i) => i.reference === `Coverage/${c.id}`));
    expect(matched).toHaveLength(1);
    expect(paymentMethodFromCoverage(matched[0])).toBe(LabPaymentMethod.ClientBill);
  });

  test('a SelfPay SR has no insurance reference — no coverage to match', () => {
    // Self-pay orders don't attach a Coverage to SR.insurance; the get-lab-orders
    // flow falls back to LabPaymentMethod.SelfPay when coveragesForServiceRequest is empty.
    const sr = makeSr([]);
    const coverages = [makeCoverage('cov-sp', ['pay'])];
    const matched = coverages.filter((c) => sr.insurance?.some((i) => i.reference === `Coverage/${c.id}`));
    expect(matched).toHaveLength(0);
  });

  test('only the coverage referenced on the SR is matched, not unrelated coverages', () => {
    const sr = makeSr(['cov-cb']);
    const coverages = [makeClientBillCoverage('cov-cb'), makeCoverage('cov-other', ['pay'])];
    const matched = coverages.filter((c) => sr.insurance?.some((i) => i.reference === `Coverage/${c.id}`));
    expect(matched).toHaveLength(1);
    expect(paymentMethodFromCoverage(matched[0])).toBe(LabPaymentMethod.ClientBill);
  });
});
