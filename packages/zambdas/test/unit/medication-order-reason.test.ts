import { Medication, MedicationAdministration, Patient } from 'fhir/r4b';
import { getReasonAndOtherReasonForNotAdministeredOrder } from 'utils/lib/fhir/medication-administration';
import {
  MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  MEDICATION_ADMINISTRATION_REASON_CODE,
} from 'utils/lib/types/api/medication-administration.constants';
import {
  inHouseMedicationsMedicationApplianceRoutes,
  MedicationData,
} from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, it } from 'vitest';
import { updateMedicationAdministrationData } from '../../src/ehr/create-update-medication-order/helpers';

const reasonNote = (text: string): NonNullable<MedicationAdministration['note']>[number] => ({
  authorString: MEDICATION_ADMINISTRATION_REASON_CODE,
  text,
});
const otherReasonNote = (text: string): NonNullable<MedicationAdministration['note']>[number] => ({
  authorString: MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  text,
});

const makeExistingMA = (note: MedicationAdministration['note']): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'ma-1',
  status: 'not-done',
  subject: { reference: 'Patient/p-1' },
  effectiveDateTime: '2026-01-01T00:00:00Z',
  note,
});

const update = (
  existedMA: MedicationAdministration,
  orderData: Partial<MedicationData>,
  newStatus?: 'administered' | 'administered-partly' | 'administered-not'
): MedicationAdministration =>
  updateMedicationAdministrationData({
    orderData: {
      patient: 'p-1',
      encounterId: 'enc-1',
      route: inHouseMedicationsMedicationApplianceRoutes.ORAL.code,
      ...orderData,
    } as MedicationData,
    orderResources: { medicationAdministration: existedMA, patient: { resourceType: 'Patient' } as Patient },
    medicationResource: { resourceType: 'Medication' } as Medication,
    newStatus,
  });

describe('create-update-medication-order - reason notes', () => {
  it('replaces the previously saved reason with the newly selected one', () => {
    const existedMA = makeExistingMA([reasonNote('patient-refused')]);

    const result = update(existedMA, { reason: 'medication-unavailable' }, 'administered-partly');

    expect(getReasonAndOtherReasonForNotAdministeredOrder(result).reason).toBe('medication-unavailable');
    expect(result.note?.filter((n) => n.authorString === MEDICATION_ADMINISTRATION_REASON_CODE)).toHaveLength(1);
    expect(existedMA.note).toEqual([reasonNote('patient-refused')]);
  });

  it('drops the stale "other" reason when a non-other reason is selected, keeping unrelated notes', () => {
    const unrelatedNote = { authorString: 'something-else', text: 'keep me' };
    const existedMA = makeExistingMA([unrelatedNote, reasonNote('other'), otherReasonNote('free text')]);

    const result = update(existedMA, { reason: 'patient-refused', otherReason: '' }, 'administered-not');

    expect(getReasonAndOtherReasonForNotAdministeredOrder(result)).toEqual({
      reason: 'patient-refused',
      otherReason: undefined,
    });
    expect(result.note).toEqual([unrelatedNote, reasonNote('patient-refused')]);
  });

  it('clears the reason when the order is switched to administered', () => {
    const existedMA = makeExistingMA([reasonNote('other'), otherReasonNote('free text')]);

    const result = update(existedMA, { reason: 'other', otherReason: 'free text' }, 'administered');

    expect(getReasonAndOtherReasonForNotAdministeredOrder(result)).toEqual({
      reason: undefined,
      otherReason: undefined,
    });
    expect(result.note).toBeUndefined();
  });

  it('keeps the reason when the order is edited without a status change', () => {
    const existedMA = makeExistingMA([reasonNote('patient-refused')]);

    const result = update(existedMA, { reason: 'patient-refused' });

    expect(result.note).toEqual([reasonNote('patient-refused')]);
  });
});
