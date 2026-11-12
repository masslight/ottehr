import Oystehr from '@oystehr/sdk';
import { Encounter, Observation, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { makeVfcEligibilityObservation, VFC_ELIGIBILITY_CODE_SYSTEM } from 'utils/lib/fhir/vfc';
import { SELF_PAY_OPTION } from 'utils/lib/ottehr-config/value-sets';
import { PATIENT_HAS_MEDICAID_URL } from 'utils/lib/types/constants';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/immunization/vfc-eligibility/index';

const bundle = <T>(resources: T[]): { unbundle: () => T[] } => ({ unbundle: () => resources });

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111';
const encounter: Encounter = {
  resourceType: 'Encounter',
  id: ENCOUNTER_ID,
  status: 'in-progress',
  class: { code: 'AMB' },
  subject: { reference: 'Patient/pat-1' },
};
const child: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  birthDate: DateTime.now().minus({ years: 4 }).toISODate(),
};
const adult: Patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  birthDate: DateTime.now().minus({ years: 40 }).toISODate(),
};

// The intake paperwork response, as selectIntakeQuestionnaireResponse recognises it.
const paperwork = (paymentOption?: string, medicaid?: boolean): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  status: 'completed',
  questionnaire: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson|1.0.0',
  encounter: { reference: `Encounter/${ENCOUNTER_ID}` },
  item: [
    {
      linkId: 'payment-option-page',
      item: [
        ...(paymentOption ? [{ linkId: 'payment-option', answer: [{ valueString: paymentOption }] }] : []),
        ...(medicaid !== undefined ? [{ linkId: 'patient-has-medicaid', answer: [{ valueBoolean: medicaid }] }] : []),
      ],
    },
  ],
});

/** An Oystehr whose searches answer by resource type: the visit, coverages and eligibility observations. */
const mockOystehr = ({
  patient,
  qr,
  coverages = [],
  eligibility = [],
}: {
  patient: Patient;
  qr?: QuestionnaireResponse;
  coverages?: unknown[];
  eligibility?: Observation[];
}): Oystehr => {
  const search = vi.fn().mockImplementation(async ({ resourceType }: { resourceType: string }) => {
    if (resourceType === 'Encounter') return bundle([encounter, patient, ...(qr ? [qr] : [])]);
    if (resourceType === 'Coverage') return bundle(coverages);
    if (resourceType === 'Observation') return bundle(eligibility);
    throw new Error(`unexpected search ${resourceType}`);
  });
  const create = vi.fn().mockImplementation(async (resource: Observation) => ({ ...resource, id: 'obs-new' }));
  const patch = vi.fn().mockResolvedValue({});
  return { fhir: { search, create, patch } } as unknown as Oystehr;
};

describe('vfc-eligibility', () => {
  it('does not apply to patients over 18 and refuses to record one', async () => {
    const oystehr = mockOystehr({ patient: adult });
    expect(await performEffect(oystehr, { action: 'get', encounterId: ENCOUNTER_ID }, 'Practitioner/me')).toEqual({
      applies: false,
    });
    await expect(
      performEffect(oystehr, { action: 'confirm', encounterId: ENCOUNTER_ID, code: 'V02' }, 'Practitioner/me')
    ).rejects.toMatchObject({ message: expect.stringContaining('18 and younger') });
  });

  it('works the eligibility out from the paperwork: Medicaid checkbox', async () => {
    const oystehr = mockOystehr({ patient: child, qr: paperwork('I have insurance', true) });
    const result = await performEffect(oystehr, { action: 'get', encounterId: ENCOUNTER_ID }, 'Practitioner/me');
    expect(result).toMatchObject({ applies: true, derived: { code: 'V02' } });
    expect(result.confirmed).toBeUndefined();
  });

  it('…or the patient flag, even without the paperwork answer', async () => {
    const flagged: Patient = { ...child, extension: [{ url: PATIENT_HAS_MEDICAID_URL, valueBoolean: true }] };
    const result = await performEffect(
      mockOystehr({ patient: flagged, qr: paperwork('I have insurance') }),
      { action: 'get', encounterId: ENCOUNTER_ID },
      'Practitioner/me'
    );
    expect(result.derived?.code).toBe('V02');
  });

  it('self-pay with no insurance on file is uninsured; insurance on file is not eligible', async () => {
    expect(
      (
        await performEffect(
          mockOystehr({ patient: child, qr: paperwork(SELF_PAY_OPTION) }),
          { action: 'get', encounterId: ENCOUNTER_ID },
          'Practitioner/me'
        )
      ).derived?.code
    ).toBe('V03');
    expect(
      (
        await performEffect(
          mockOystehr({ patient: child, qr: paperwork('I have insurance'), coverages: [{ resourceType: 'Coverage' }] }),
          { action: 'get', encounterId: ENCOUNTER_ID },
          'Practitioner/me'
        )
      ).derived?.code
    ).toBe('V01');
  });

  it('says nothing when there is no paperwork and no insurance', async () => {
    const result = await performEffect(
      mockOystehr({ patient: child }),
      { action: 'get', encounterId: ENCOUNTER_ID },
      'Practitioner/me'
    );
    expect(result).toEqual({ applies: true });
  });

  it('confirming records an Observation on the visit and supersedes an earlier confirmation', async () => {
    const earlier = {
      ...makeVfcEligibilityObservation({
        encounterId: ENCOUNTER_ID,
        patientId: 'pat-1',
        code: 'V01',
        performerReference: 'Practitioner/front-desk',
        effectiveDateTime: '2026-11-10T14:00:00.000Z',
      }),
      id: 'obs-old',
    };
    const oystehr = mockOystehr({ patient: child, qr: paperwork('I have insurance', true), eligibility: [earlier] });

    await performEffect(oystehr, { action: 'confirm', encounterId: ENCOUNTER_ID, code: 'V04' }, 'Practitioner/me');

    const created = (oystehr.fhir.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as Observation;
    expect(created).toMatchObject({
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [expect.objectContaining({ system: 'http://loinc.org', code: '64994-7' })] },
      subject: { reference: 'Patient/pat-1' },
      encounter: { reference: `Encounter/${ENCOUNTER_ID}` },
      performer: [{ reference: 'Practitioner/me' }],
      valueCodeableConcept: { coding: [{ system: VFC_ELIGIBILITY_CODE_SYSTEM, code: 'V04' }] },
    });
    expect(oystehr.fhir.patch).toHaveBeenCalledWith({
      resourceType: 'Observation',
      id: 'obs-old',
      operations: [{ op: 'replace', path: '/status', value: 'entered-in-error' }],
    });
  });

  it('reads back what was confirmed', async () => {
    const confirmed = {
      ...makeVfcEligibilityObservation({
        encounterId: ENCOUNTER_ID,
        patientId: 'pat-1',
        code: 'V03',
        performerReference: 'Practitioner/front-desk',
        effectiveDateTime: '2026-11-11T09:00:00.000Z',
      }),
      id: 'obs-1',
    };
    const result = await performEffect(
      mockOystehr({ patient: child, eligibility: [confirmed] }),
      { action: 'get', encounterId: ENCOUNTER_ID },
      'Practitioner/me'
    );
    expect(result.confirmed).toEqual({ code: 'V03', confirmedAt: '2026-11-11T09:00:00.000Z' });
  });
});
