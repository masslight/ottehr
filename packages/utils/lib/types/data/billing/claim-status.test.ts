import { Claim, Extension } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  AR_STAGE,
  buildClaimStatusDateExtensions,
  CLAIM_STATUS_DATE_EXTENSION_URLS,
  ClaimStatusValues,
  claimStatusValuesToTags,
  emptyClaimStatusValues,
} from './claim-status';

const RECORDED = '2026-07-24T12:00:00.000Z';

const before = (values: Partial<ClaimStatusValues>, extension?: Extension[]): Pick<Claim, 'meta' | 'extension'> => ({
  meta: {
    tag: claimStatusValuesToTags(values),
  },
  ...(extension ? { extension } : {}),
});

const after = (values: Partial<ClaimStatusValues>): ClaimStatusValues => ({
  ...emptyClaimStatusValues(),
  ...values,
});

describe('buildClaimStatusDateExtensions', () => {
  it('records the insurance-finalized date when insurance AR status becomes finalized', () => {
    const result = buildClaimStatusDateExtensions(
      before({
        arStage: AR_STAGE.patient,
        insuranceArStatus: 'adjudicated',
      }),
      after({
        arStage: AR_STAGE.patient,
        insuranceArStatus: 'finalized',
      }),
      RECORDED
    );
    expect(result).toEqual([
      {
        url: CLAIM_STATUS_DATE_EXTENSION_URLS.insuranceFinalized,
        valueDateTime: RECORDED,
      },
    ]);
  });

  it('records the entered-patient-AR date when the claim moves into the patient AR stage', () => {
    const result = buildClaimStatusDateExtensions(
      before({
        arStage: AR_STAGE.insurancePayer,
      }),
      after({
        arStage: AR_STAGE.patient,
      }),
      RECORDED
    );
    expect(result).toEqual([
      {
        url: CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr,
        valueDateTime: RECORDED,
      },
    ]);
  });

  it('records both dates when both transitions happen in one change', () => {
    const result = buildClaimStatusDateExtensions(
      before({
        arStage: AR_STAGE.insurancePayer,
        insuranceArStatus: 'adjudicated',
      }),
      after({
        arStage: AR_STAGE.patient,
        insuranceArStatus: 'finalized',
      }),
      RECORDED
    );
    expect(result).toEqual([
      {
        url: CLAIM_STATUS_DATE_EXTENSION_URLS.insuranceFinalized,
        valueDateTime: RECORDED,
      },
      {
        url: CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr,
        valueDateTime: RECORDED,
      },
    ]);
  });

  it('returns undefined when neither tracked transition occurs', () => {
    expect(
      buildClaimStatusDateExtensions(
        before({
          arStage: AR_STAGE.patient,
          patientArStatus: 'not-invoiced',
        }),
        after({
          arStage: AR_STAGE.patient,
          patientArStatus: 'ready-to-invoice',
        }),
        RECORDED
      )
    ).toBeUndefined();
  });

  it('does not re-record a state the claim was already in', () => {
    expect(
      buildClaimStatusDateExtensions(
        before({
          arStage: AR_STAGE.patient,
          insuranceArStatus: 'finalized',
        }),
        after({
          arStage: AR_STAGE.patient,
          insuranceArStatus: 'finalized',
        }),
        RECORDED
      )
    ).toBeUndefined();
  });

  it('preserves unrelated extensions and overwrites a prior date extension with the new timestamp', () => {
    const result = buildClaimStatusDateExtensions(
      before(
        {
          arStage: AR_STAGE.insurancePayer,
        },
        [
          {
            url: 'https://fhir.ottehr.com/Extension/unrelated',
            valueString: 'keep me',
          },
          {
            url: CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr,
            valueDateTime: '2020-01-01T00:00:00.000Z',
          },
        ]
      ),
      after({
        arStage: AR_STAGE.patient,
      }),
      RECORDED
    );
    expect(result).toEqual([
      {
        url: 'https://fhir.ottehr.com/Extension/unrelated',
        valueString: 'keep me',
      },
      {
        url: CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr,
        valueDateTime: RECORDED,
      },
    ]);
  });
});
