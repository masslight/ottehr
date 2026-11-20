// No request carries a CVX code: the server records the code of the order's vaccine with the administration codes,
// where get-immunization-orders reads it back. An order placed before the vaccine list keeps the code it has.
import Oystehr from '@oystehr/sdk';
import { Medication, MedicationAdministration, MedicationStatement, Practitioner } from 'fhir/r4b';
import { codeableConcept } from 'utils/lib/fhir/helpers';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
} from 'utils/lib/types/api/medication-administration.constants';
import {
  InputImmunizationOrderAdministrationDetails,
  InputImmunizationOrderDetails,
} from 'utils/lib/types/data/immunization/types';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import {
  administerImmunizationOrder,
  validateRequestParameters as validateAdministerRequest,
} from '../../src/ehr/immunization/administer-order';
import {
  applyOrderAdministrationDetails,
  CONTAINED_MEDICATION_ID,
  createOrderVaccineMedication,
  getContainedMedication,
  getOrderVaccineCvx,
  IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
  updateOrderDetails,
} from '../../src/ehr/immunization/common';
import { mapMedicationAdministrationToImmunizationOrder } from '../../src/ehr/immunization/get-orders';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const TDAP_CVX = '115';
const MMR_CVX = '03';
const LEGACY_MEDICATION_ID = 'a3f1c2d4-0000-4000-8000-000000000001';

const practitioner: Practitioner = { resourceType: 'Practitioner', id: 'pr-1', name: [{ family: 'Lee' }] };

const order = (medication: Medication): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'order-1',
  status: 'in-progress',
  subject: { reference: 'Patient/p1' },
  context: { reference: 'Encounter/e1' },
  effectiveDateTime: '2026-10-27T10:00:00Z',
  medicationReference: { reference: '#' + CONTAINED_MEDICATION_ID },
  contained: [medication],
});

const listVaccineOrder = (cvx = TDAP_CVX): MedicationAdministration =>
  order(createOrderVaccineMedication(getCvxVaccine(cvx)!));

// As create-update-immunization-order stored it while vaccines were config Medications and the CVX code was typed.
const legacyOrder = (typedCvx?: string): MedicationAdministration =>
  order({
    resourceType: 'Medication',
    id: CONTAINED_MEDICATION_ID,
    identifier: [
      { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
      { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Tdap (Adacel/Boostrix)' },
    ],
    extension: [
      { url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: LEGACY_MEDICATION_ID },
      ...(typedCvx
        ? [
            {
              url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
              valueCodeableConcept: codeableConcept(typedCvx, CVX_CODE_SYSTEM_URL),
            },
          ]
        : []),
    ],
  });

const details = (medication: InputImmunizationOrderDetails['medication']): InputImmunizationOrderDetails => ({
  medication,
  dose: '0.5',
  units: 'mL',
  orderedProvider: { id: 'pr-1', name: 'Lee' },
});

const LEGACY_VACCINE = { id: LEGACY_MEDICATION_ID, name: 'Tdap (Adacel/Boostrix)' };

const recordedCvx = (medicationAdministration: MedicationAdministration): string | undefined =>
  mapMedicationAdministrationToImmunizationOrder(medicationAdministration).administrationDetails?.cvx;

/** Every CVX code among a vaccine's administration codes. */
const administrationCvxCodes = (medication: Medication | undefined): (string | undefined)[] =>
  (medication?.extension ?? [])
    .filter((extension) => extension.url === VACCINE_ADMINISTRATION_CODES_EXTENSION_URL)
    .flatMap((extension) => extension.valueCodeableConcept?.coding ?? [])
    .filter((coding) => coding.system === CVX_CODE_SYSTEM_URL)
    .map((coding) => coding.code);

const mockOystehr = (
  medicationAdministration: MedicationAdministration
): { oystehr: Oystehr; transaction: ReturnType<typeof vi.fn> } => {
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const get = vi.fn(async ({ resourceType }: { resourceType: string }) =>
    resourceType === 'MedicationAdministration' ? medicationAdministration : practitioner
  );
  const search = vi.fn().mockResolvedValue({ unbundle: () => [] });
  return { oystehr: { fhir: { get, search, transaction } } as unknown as Oystehr, transaction };
};

const administer = async (
  medicationAdministration: MedicationAdministration,
  body: { type: string; medication: InputImmunizationOrderDetails['medication']; cvx?: string }
): Promise<ReturnType<typeof vi.fn>> => {
  const { oystehr, transaction } = mockOystehr(medicationAdministration);
  const validated = validateAdministerRequest(
    createMockZambdaInput({
      orderId: 'order-1',
      type: body.type,
      ...(body.type === 'administered' ? {} : { reason: 'patient-refused' }),
      details: details(body.medication),
      administrationDetails: {
        lot: 'L1',
        expDate: '2027-01-31',
        mvx: 'SKB',
        ndc: '58160-0842-11',
        administeredDateTime: '2026-10-28T09:30:00.000+01:00',
        visGivenDate: '2026-10-28',
        ...(body.cvx ? { cvx: body.cvx } : {}),
      },
    })
  );
  await administerImmunizationOrder(oystehr, validated, practitioner);
  return transaction;
};

describe('getOrderVaccineCvx', () => {
  it('is the CVX code of a vaccine from the vaccine list', () => {
    expect(getOrderVaccineCvx(getContainedMedication(listVaccineOrder())!)).toBe(TDAP_CVX);
  });

  it('is the code recorded with a vaccine ordered before the list', () => {
    expect(getOrderVaccineCvx(getContainedMedication(legacyOrder('140'))!)).toBe('140');
  });

  it('is nothing for a vaccine ordered before the list that has no code recorded', () => {
    expect(getOrderVaccineCvx(getContainedMedication(legacyOrder())!)).toBeUndefined();
  });
});

describe('order-time administration details - CVX code', () => {
  it('records the CVX code of the vaccine when nothing else is entered', () => {
    const pending = listVaccineOrder();

    applyOrderAdministrationDetails(pending, {});

    expect(recordedCvx(pending)).toBe(TDAP_CVX);
  });

  it('ignores a CVX code sent in the request', () => {
    const pending = listVaccineOrder();

    applyOrderAdministrationDetails(pending, { cvx: '999' } as InputImmunizationOrderAdministrationDetails);

    expect(recordedCvx(pending)).toBe(TDAP_CVX);
  });

  it('replaces a typed code that disagrees with the vaccine', () => {
    const pending = listVaccineOrder();
    getContainedMedication(pending)!.extension!.push({
      url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
      valueCodeableConcept: codeableConcept('999', CVX_CODE_SYSTEM_URL),
    });

    applyOrderAdministrationDetails(pending, { lot: 'L1' });

    expect(administrationCvxCodes(getContainedMedication(pending))).toEqual([TDAP_CVX]);
  });

  it('follows the vaccine when the order is moved to another one', async () => {
    const pending = listVaccineOrder();
    applyOrderAdministrationDetails(pending, { lot: 'L1' });

    await updateOrderDetails(pending, details({ id: MMR_CVX, name: 'MMR' }), mockOystehr(pending).oystehr);
    applyOrderAdministrationDetails(pending, { lot: 'L2' });

    expect(recordedCvx(pending)).toBe(MMR_CVX);
  });

  it('keeps the code typed on an order placed before the vaccine list', async () => {
    const pending = legacyOrder('140');

    await updateOrderDetails(pending, details(LEGACY_VACCINE), mockOystehr(pending).oystehr);
    applyOrderAdministrationDetails(pending, { lot: 'L1' });

    expect(recordedCvx(pending)).toBe('140');
  });

  it('takes the code of the list vaccine an order placed before the list is moved to', async () => {
    const pending = legacyOrder('140');

    await updateOrderDetails(pending, details({ id: TDAP_CVX, name: 'Tdap' }), mockOystehr(pending).oystehr);
    applyOrderAdministrationDetails(pending, {});

    expect(recordedCvx(pending)).toBe(TDAP_CVX);
  });
});

describe('administer-immunization-order - CVX code', () => {
  it('does not ask the request for a CVX code', () => {
    expect(() =>
      validateAdministerRequest(
        createMockZambdaInput({
          orderId: 'order-1',
          type: 'administered',
          details: details({ id: TDAP_CVX, name: 'Tdap' }),
          administrationDetails: {
            lot: 'L1',
            expDate: '2027-01-31',
            mvx: 'SKB',
            ndc: '58160-0842-11',
            administeredDateTime: '2026-10-28T09:30:00.000+01:00',
            visGivenDate: '2026-10-28',
          },
        })
      )
    ).not.toThrow();
  });

  it('records the CVX code of the vaccine on the administration and the statement, whatever the request sends', async () => {
    const transaction = await administer(listVaccineOrder(), {
      type: 'administered',
      medication: { id: TDAP_CVX, name: 'Tdap' },
      cvx: '999',
    });

    const [put, post] = transaction.mock.calls[0][0].requests;
    expect(recordedCvx(put.resource as MedicationAdministration)).toBe(TDAP_CVX);
    const statementVaccine = (post.resource as MedicationStatement).contained?.find(
      (resource) => resource.id === CONTAINED_MEDICATION_ID
    ) as Medication | undefined;
    expect(administrationCvxCodes(statementVaccine)).toEqual([TDAP_CVX]);
  });

  it('records the CVX code of the vaccine the order is changed to while administering', async () => {
    const transaction = await administer(listVaccineOrder(), {
      type: 'administered-partly',
      medication: { id: MMR_CVX, name: 'MMR' },
    });

    expect(recordedCvx(transaction.mock.calls[0][0].requests[0].resource)).toBe(MMR_CVX);
  });

  it('administers an order placed before the vaccine list with the code typed on it', async () => {
    const transaction = await administer(legacyOrder('140'), { type: 'administered', medication: LEGACY_VACCINE });

    expect(recordedCvx(transaction.mock.calls[0][0].requests[0].resource)).toBe('140');
  });

  it.each(['administered', 'administered-partly'])(
    'rejects %s for a vaccine ordered before the list that has no CVX code, and saves nothing',
    async (type) => {
      const pending = legacyOrder();
      const { oystehr, transaction } = mockOystehr(pending);
      const validated = validateAdministerRequest(
        createMockZambdaInput({
          orderId: 'order-1',
          type,
          reason: 'patient-refused',
          details: details(LEGACY_VACCINE),
          administrationDetails: {
            lot: 'L1',
            expDate: '2027-01-31',
            mvx: 'SKB',
            ndc: '58160-0842-11',
            administeredDateTime: '2026-10-28T09:30:00.000+01:00',
            visGivenDate: '2026-10-28',
          },
        })
      );

      await expect(administerImmunizationOrder(oystehr, validated, practitioner)).rejects.toMatchObject({
        code: APIErrorCode.INVALID_INPUT,
        message: expect.stringContaining('"Tdap (Adacel/Boostrix)" has no CVX code'),
      });
      expect(transaction).not.toHaveBeenCalled();
    }
  );

  it('marks a vaccine ordered before the list not administered without a CVX code', async () => {
    const transaction = await administer(legacyOrder(), { type: 'administered-not', medication: LEGACY_VACCINE });

    expect(transaction.mock.calls[0][0].requests[0].resource.status).toBe('not-done');
  });
});
