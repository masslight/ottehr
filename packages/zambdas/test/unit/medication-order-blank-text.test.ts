import { Medication } from 'fhir/r4b';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { MEDICATION_ADMINISTRATION_OTHER_REASON_CODE } from 'utils/lib/types/api/medication-administration.constants';
import {
  inHouseMedicationsMedicationApplianceRoutes,
  MedicationData,
} from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, it } from 'vitest';
import { createMedicationAdministrationResource } from '../../src/ehr/create-update-medication-order/fhir-resources-creation';
import { createMedicationCopy } from '../../src/ehr/create-update-medication-order/helpers';
import { validateRequestParameters } from '../../src/ehr/create-update-medication-order/validateRequestParameters';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const baseOrderData = {
  patient: 'patient-1',
  encounterId: 'encounter-1',
  medicationId: 'med-1',
  units: 'mg',
  dose: 10,
  route: inHouseMedicationsMedicationApplianceRoutes.ORAL.code,
};

const validate = (body: Record<string, unknown>): ReturnType<typeof validateRequestParameters> =>
  validateRequestParameters(createMockZambdaInput(body));

const inventoryCopy = (): Medication => ({
  resourceType: 'Medication',
  code: { coding: [{ system: CODE_SYSTEM_NDC, code: '0409-4888-02' }] },
  manufacturer: { display: 'Pfizer' },
  batch: { lotNumber: 'L1', expirationDate: '2027-01-31' },
});

describe('create-update-medication-order - blank and padded free text', () => {
  it('drops whitespace-only instructions, manufacturer, lot number and other reason', () => {
    const { orderData } = validate({
      orderData: {
        ...baseOrderData,
        instructions: '  \n ',
        manufacturer: '   ',
        lotNumber: ' ',
        otherReason: '\t',
      },
    });

    expect(orderData?.instructions).toBeUndefined();
    expect(orderData?.manufacturer).toBeUndefined();
    expect(orderData?.lotNumber).toBeUndefined();
    expect(orderData?.otherReason).toBeUndefined();
  });

  it('turns cleared optional text into undefined', () => {
    const { orderData } = validate({
      orderId: 'order-1',
      orderData: { ...baseOrderData, instructions: '', manufacturer: '', lotNumber: '', ndc: '' },
    });

    expect(orderData?.instructions).toBeUndefined();
    expect(orderData?.manufacturer).toBeUndefined();
    expect(orderData?.lotNumber).toBeUndefined();
    expect(orderData?.ndc).toBeUndefined();
  });

  it('keeps non-blank text and trims its ends', () => {
    const { orderData } = validate({
      orderData: {
        ...baseOrderData,
        instructions: ' Take  with water ',
        manufacturer: 'Pfizer ',
        lotNumber: ' L-42',
        otherReason: ' Vomited ',
      },
    });

    expect(orderData).toMatchObject({
      instructions: 'Take  with water',
      manufacturer: 'Pfizer',
      lotNumber: 'L-42',
      otherReason: 'Vomited',
    });
  });

  it('makes a padded NDC a valid FHIR code', () => {
    const { orderData } = validate({ orderData: { ...baseOrderData, ndc: ' 0409-4888-02  ' } });

    expect(orderData?.ndc).toBe('0409-4888-02');
  });

  it('collapses inner whitespace runs in the NDC', () => {
    const { orderData } = validate({ orderData: { ...baseOrderData, ndc: '0409  4888 02' } });

    expect(orderData?.ndc).toBe('0409 4888 02');
  });

  it('drops a whitespace-only NDC', () => {
    const { orderData } = validate({ orderData: { ...baseOrderData, ndc: '   ' } });

    expect(orderData?.ndc).toBeUndefined();
  });

  it('rejects a whitespace-only reason when it is required', () => {
    expect(() => validate({ orderId: 'order-1', newStatus: 'administered-not', orderData: { reason: '   ' } })).toThrow(
      'Reason should be provided'
    );
  });

  it('leaves a status-only request without order data untouched', () => {
    const result = validate({ orderId: 'order-1', newStatus: 'cancelled' });

    expect(result.orderData).toBeUndefined();
  });

  it('builds a medication administration without dosage text or other-reason note from blank input', () => {
    const { orderData } = validate({
      orderData: { ...baseOrderData, instructions: '   ', reason: 'other', otherReason: '  ' },
    });

    const resource = createMedicationAdministrationResource({
      orderData: orderData as MedicationData,
      status: 'in-progress',
      route: inHouseMedicationsMedicationApplianceRoutes.ORAL,
    });

    expect(resource.dosage).toBeDefined();
    expect(resource.dosage?.text).toBeUndefined();
    expect(resource.note?.some((note) => note.authorString === MEDICATION_ADMINISTRATION_OTHER_REASON_CODE)).toBe(
      false
    );
  });

  it('keeps a valid NDC coding and no blank manufacturer on the medication copy built from blank input', () => {
    const { orderData } = validate({
      orderData: { ...baseOrderData, ndc: '  ', manufacturer: '  ', lotNumber: '  ' },
    });

    const copy = createMedicationCopy(inventoryCopy(), orderData!);

    expect(copy.code?.coding).toEqual([{ system: CODE_SYSTEM_NDC, code: '0409-4888-02' }]);
    expect(copy.manufacturer).toEqual({ display: 'Pfizer' });
    expect(copy.batch).toEqual({ lotNumber: 'L1', expirationDate: '2027-01-31' });
  });
});

describe('create-update-medication-order - new order created with a status', () => {
  const administeredOrderData = { ...baseOrderData, effectiveDateTime: '2026-11-09T10:00:00Z' };

  it('accepts a new administered order that identifies its encounter by encounterId', () => {
    const { orderData } = validate({ newStatus: 'administered', orderData: administeredOrderData });

    expect(orderData?.encounterId).toBe('encounter-1');
  });

  it.each([undefined, ''])('rejects a new administered order with encounterId %j', (encounterId) => {
    expect(() => validate({ newStatus: 'administered', orderData: { ...administeredOrderData, encounterId } })).toThrow(
      'Missing fields in orderData: encounterId'
    );
  });

  it('rejects an administered order without effectiveDateTime', () => {
    expect(() => validate({ orderId: 'order-1', newStatus: 'administered', orderData: baseOrderData })).toThrow(
      'effectiveDateTime field should be present'
    );
  });
});

describe('createMedicationCopy - batch', () => {
  it('clears the lot number but keeps the expiration date when the lot is emptied', () => {
    const copy = createMedicationCopy(inventoryCopy(), { lotNumber: '', expDate: '2027-01-31' });

    expect(copy.batch).toEqual({ expirationDate: '2027-01-31' });
    expect(JSON.parse(JSON.stringify(copy)).batch).toEqual({ expirationDate: '2027-01-31' });
  });

  it('drops an empty expiration date next to a lot number', () => {
    const copy = createMedicationCopy(inventoryCopy(), { lotNumber: 'L2', expDate: '' });

    expect(JSON.parse(JSON.stringify(copy)).batch).toEqual({ lotNumber: 'L2' });
  });

  it('keeps the stored batch for a not-administered order', () => {
    const copy = createMedicationCopy(inventoryCopy(), { lotNumber: 'L2', expDate: '' }, 'administered-not');

    expect(copy.batch).toEqual({ lotNumber: 'L1', expirationDate: '2027-01-31' });
  });
});
