import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration, MedicationStatement, Organization, Practitioner } from 'fhir/r4b';
import { InputImmunizationOrderDetails } from 'utils/lib/types/data/immunization/types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import {
  administerImmunizationOrder,
  validateRequestParameters as validateAdministerRequest,
} from '../../src/ehr/immunization/administer-order';
import {
  CONTAINED_MANUFACTURER_ORG_ID,
  CONTAINED_MEDICATION_ID,
  IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
  updateOrderDetails,
  updateVaccineMedicationDetails,
  validateAdministrationDetailsValues,
} from '../../src/ehr/immunization/common';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'pr-1',
  name: [{ given: ['Ann'], family: 'Lee' }],
};

const pendingOrder = (): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'order-1',
  status: 'in-progress',
  subject: { reference: 'Patient/p1' },
  context: { reference: 'Encounter/e1' },
  effectiveDateTime: '2026-10-27T10:00:00Z',
  medicationReference: { reference: '#' + CONTAINED_MEDICATION_ID },
  contained: [
    {
      resourceType: 'Medication',
      id: CONTAINED_MEDICATION_ID,
      extension: [{ url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: 'med-1' }],
    },
  ],
});

const orderDetails = (overrides: Partial<InputImmunizationOrderDetails> = {}): InputImmunizationOrderDetails => ({
  medication: { id: 'med-1', name: 'Tdap' },
  dose: '0.5',
  units: 'mL',
  orderedProvider: { id: 'pr-1', name: 'Ann Lee' },
  ...overrides,
});

const mockOystehr = (order: MedicationAdministration): { oystehr: Oystehr; transaction: ReturnType<typeof vi.fn> } => {
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const get = vi.fn(async ({ resourceType }: { resourceType: string }) =>
    resourceType === 'MedicationAdministration' ? order : practitioner
  );
  // the Immunization record lookup, the VFC eligibility read and the stock reads all find nothing here
  const search = vi.fn().mockResolvedValue({ unbundle: () => [], entry: [] });
  return { oystehr: { fhir: { get, search, transaction } } as unknown as Oystehr, transaction };
};

const manufacturerOrg = (ma: MedicationAdministration): Organization | undefined =>
  ma.contained?.find((r) => r.id === CONTAINED_MANUFACTURER_ORG_ID) as Organization | undefined;

const containedMedication = (ma: MedicationAdministration): Medication | undefined =>
  ma.contained?.find((r) => r.id === CONTAINED_MEDICATION_ID) as Medication | undefined;

const thrownBy = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected function to throw');
};

const administeredBody = {
  orderId: 'order-1',
  type: 'administered',
  details: orderDetails(),
  administrationDetails: {
    lot: 'L1',
    expDate: '2027-01-31',
    mvx: 'SKB',
    cvx: '115',
    ndc: '58160-0842-11',
    administeredDateTime: '2026-10-28T09:30:00.000+01:00',
    visGivenDate: '2026-10-28',
  },
};

describe('immunization updateOrderDetails - blank free text', () => {
  it('does not write whitespace-only instructions to dosage.text', async () => {
    const order = pendingOrder();
    await updateOrderDetails(order, orderDetails({ instructions: '  \n ' }), mockOystehr(order).oystehr);

    expect(order.dosage?.text).toBeUndefined();
  });

  it('does not write empty instructions to dosage.text', async () => {
    const order = pendingOrder();
    await updateOrderDetails(order, orderDetails({ instructions: '' }), mockOystehr(order).oystehr);

    expect(order.dosage?.text).toBeUndefined();
  });

  it('keeps typed instructions without the surrounding whitespace', async () => {
    const order = pendingOrder();
    await updateOrderDetails(order, orderDetails({ instructions: ' Left  deltoid ' }), mockOystehr(order).oystehr);

    expect(order.dosage?.text).toBe('Left  deltoid');
  });

  it('does not create a manufacturer organization for a whitespace-only manufacturer', async () => {
    const order = pendingOrder();
    await updateOrderDetails(order, orderDetails({ manufacturer: '   ' }), mockOystehr(order).oystehr);

    expect(manufacturerOrg(order)).toBeUndefined();
    expect(containedMedication(order)?.manufacturer).toBeUndefined();
  });

  it('removes a stored manufacturer when it is replaced by whitespace', async () => {
    const order = pendingOrder();
    const { oystehr } = mockOystehr(order);
    await updateOrderDetails(order, orderDetails({ manufacturer: 'Sanofi' }), oystehr);
    expect(manufacturerOrg(order)?.name).toBe('Sanofi');

    await updateOrderDetails(order, orderDetails({ manufacturer: ' ' }), oystehr);

    expect(manufacturerOrg(order)).toBeUndefined();
    expect(containedMedication(order)?.manufacturer).toBeUndefined();
  });

  it('stores a padded manufacturer name trimmed', async () => {
    const order = pendingOrder();
    await updateOrderDetails(order, orderDetails({ manufacturer: ' Sanofi ' }), mockOystehr(order).oystehr);

    expect(manufacturerOrg(order)?.name).toBe('Sanofi');
    expect(containedMedication(order)?.manufacturer).toEqual({ reference: '#' + CONTAINED_MANUFACTURER_ORG_ID });
  });
});

describe('immunization validateAdministrationDetailsValues - lot and codes', () => {
  it('drops a whitespace-only lot', () => {
    const details: { lot?: string } = { lot: '   ' };
    validateAdministrationDetailsValues(details);
    expect(details.lot).toBeUndefined();
  });

  it('trims a padded lot', () => {
    const details: { lot?: string } = { lot: ' L-42 ' };
    validateAdministrationDetailsValues(details);
    expect(details.lot).toBe('L-42');
  });

  it('drops whitespace-only codes', () => {
    const details: { mvx?: string; cvx?: string; ndc?: string } = { mvx: ' ', cvx: '\t', ndc: '  ' };
    validateAdministrationDetailsValues(details);
    expect(details).toEqual({ mvx: undefined, cvx: undefined, ndc: undefined });
  });

  it('collapses inner whitespace runs in a code', () => {
    const details: { ndc?: string } = { ndc: ' 58160  0842 11 ' };
    validateAdministrationDetailsValues(details);
    expect(details.ndc).toBe('58160 0842 11');
  });
});

describe('immunization updateVaccineMedicationDetails - batch', () => {
  it('omits an empty lot number next to an expiration date', () => {
    const medication: Medication = { resourceType: 'Medication', batch: { lotNumber: 'L1' } };
    updateVaccineMedicationDetails(medication, { lot: '', expDate: '2027-01-31' });
    expect(JSON.parse(JSON.stringify(medication.batch))).toEqual({ expirationDate: '2027-01-31' });
  });

  it('omits an empty expiration date next to a lot number', () => {
    const medication: Medication = { resourceType: 'Medication' };
    updateVaccineMedicationDetails(medication, { lot: 'L1', expDate: '' });
    expect(JSON.parse(JSON.stringify(medication.batch))).toEqual({ lotNumber: 'L1' });
  });
});

describe('administer-immunization-order validateRequestParameters - blank text', () => {
  it('rejects a whitespace-only reason for a not administered order with a 400', () => {
    const error = thrownBy(() =>
      validateAdministerRequest(
        createMockZambdaInput({ orderId: 'order-1', type: 'administered-not', reason: '   ', details: orderDetails() })
      )
    );
    expect(error).toMatchObject({ code: APIErrorCode.INVALID_INPUT, message: expect.stringContaining('reason') });
  });

  it('returns a padded reason trimmed', () => {
    const result = validateAdministerRequest(
      createMockZambdaInput({
        orderId: 'order-1',
        type: 'administered-partly',
        reason: ' Patient fainted ',
        details: administeredBody.details,
        administrationDetails: administeredBody.administrationDetails,
      })
    );
    expect(result.reason).toBe('Patient fainted');
  });

  it('drops a whitespace-only reason on an administered order', () => {
    const result = validateAdministerRequest(createMockZambdaInput({ ...administeredBody, reason: '  ' }));
    expect(result.reason).toBeUndefined();
  });

  it.each(['lot', 'mvx', 'cvx', 'ndc'] as const)('rejects a whitespace-only %s as missing with a 400', (field) => {
    const error = thrownBy(() =>
      validateAdministerRequest(
        createMockZambdaInput({
          ...administeredBody,
          administrationDetails: { ...administeredBody.administrationDetails, [field]: '   ' },
        })
      )
    );
    expect(error).toMatchObject({
      code: APIErrorCode.INVALID_INPUT,
      message: expect.stringContaining(`administrationDetails.${field}`),
    });
  });
});

describe('administerImmunizationOrder - blank input', () => {
  it('keeps the existing effectiveDateTime when a not administered order has no administered date', async () => {
    const order = pendingOrder();
    const { oystehr, transaction } = mockOystehr(order);

    const validated = validateAdministerRequest(
      createMockZambdaInput({
        orderId: 'order-1',
        type: 'administered-not',
        reason: 'patient-refused',
        details: orderDetails(),
        administrationDetails: {},
      })
    );

    await administerImmunizationOrder(oystehr, validated, practitioner);

    const put = transaction.mock.calls[0][0].requests[0];
    expect(put.resource.effectiveDateTime).toBe('2026-10-27T10:00:00Z');
    expect(put.resource.note).toEqual([expect.objectContaining({ text: 'patient-refused' })]);
  });

  it('writes no blank dosage text, manufacturer or lot to the administration and statement', async () => {
    const order = pendingOrder();
    const { oystehr, transaction } = mockOystehr(order);
    const validated = validateAdministerRequest(
      createMockZambdaInput({
        ...administeredBody,
        details: orderDetails({ instructions: ' ', manufacturer: '  ' }),
        administrationDetails: { ...administeredBody.administrationDetails, lot: 'L1' },
      })
    );

    await administerImmunizationOrder(oystehr, validated, practitioner);

    const [put, post] = transaction.mock.calls[0][0].requests;
    const administration = put.resource as MedicationAdministration;
    const statement = post.resource as MedicationStatement;
    expect(administration.dosage?.text).toBeUndefined();
    expect(manufacturerOrg(administration)).toBeUndefined();
    expect(statement.dosage?.[0].text).toBeUndefined();
    expect(statement.contained?.some((r) => r.resourceType === 'Organization')).toBe(false);
  });
});
