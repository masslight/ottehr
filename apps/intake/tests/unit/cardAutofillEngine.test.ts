import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import {
  buildInsuranceFills,
  buildPhotoIdFills,
  isFieldUserEdited,
  matchCarrierToOptions,
  matchStateOption,
  mergeInsuranceFields,
  normalizeZipForFill,
  payerIdFromOptionReference,
} from 'ui-components/lib/components/paperwork/hooks/cardAutofillEngine';
import { InsuranceCardExtractionFields, PhotoIdExtractionFields } from 'utils';
import { describe, expect, it } from 'vitest';

// Options as get-patient-insurance-payers returns them: valueReference.reference is
// constructPayerUrl(payerId) — the payer ID is the URL's last path segment — and display is
// the payer name. The synthetic "Other" option carries type: 'other' and id 00000.
const option = (payerId: string, display: string, type?: string): QuestionnaireItemAnswerOption => ({
  valueReference: {
    reference: `https://rcm-api.zapehr.com/v1/payer/${payerId}`,
    display,
    ...(type ? { type } : {}),
  },
});

const PAYER_OPTIONS: QuestionnaireItemAnswerOption[] = [
  option('60054', 'Aetna'),
  option('00390', 'BlueCross BlueShield of Tennessee'),
  option('87726', 'UnitedHealthcare'),
  option('00000', 'Other', 'other'),
];

const emptyInsuranceFields: InsuranceCardExtractionFields = {
  payer: null,
  memberName: null,
  memberId: null,
  groupNumber: null,
  payerId: null,
  rxBin: null,
  rxPcn: null,
  rxGroup: null,
  insuranceType: null,
  effectiveDate: null,
};

const emptyPhotoIdFields: PhotoIdExtractionFields = {
  firstName: null,
  middleName: null,
  lastName: null,
  suffix: null,
  dateOfBirth: null,
  sex: null,
  addressLine1: null,
  addressCity: null,
  addressState: null,
  addressZip: null,
  licenseNumber: null,
  expirationDate: null,
};

describe('payerIdFromOptionReference', () => {
  it('parses the payer id from the constructPayerUrl reference', () => {
    expect(payerIdFromOptionReference('https://rcm-api.zapehr.com/v1/payer/60054')).toBe('60054');
  });
});

describe('matchCarrierToOptions', () => {
  it('matches by exact payer ID first, even when the name differs', () => {
    const result = matchCarrierToOptions('Aetna Better Health', '60054', PAYER_OPTIONS);
    expect(result).toEqual({
      kind: 'match',
      valueReference: { reference: 'https://rcm-api.zapehr.com/v1/payer/60054', display: 'Aetna' },
    });
  });

  it('falls back to case-insensitive normalized name matching when there is no payer ID', () => {
    const result = matchCarrierToOptions('  blue cross blueshield OF tennessee ', null, PAYER_OPTIONS);
    expect(result).toEqual({
      kind: 'match',
      valueReference: {
        reference: 'https://rcm-api.zapehr.com/v1/payer/00390',
        display: 'BlueCross BlueShield of Tennessee',
      },
    });
  });

  it('falls through to name matching when the payer ID matches nothing', () => {
    const result = matchCarrierToOptions('UnitedHealthcare', 'ZZZZZ', PAYER_OPTIONS);
    expect(result).toEqual({
      kind: 'match',
      valueReference: { reference: 'https://rcm-api.zapehr.com/v1/payer/87726', display: 'UnitedHealthcare' },
    });
  });

  it('surfaces the carrier name as a hint when nothing matches', () => {
    expect(matchCarrierToOptions('Cigna', null, PAYER_OPTIONS)).toEqual({ kind: 'hint', carrierName: 'Cigna' });
  });

  it('never matches the synthetic "Other" option', () => {
    // 'Other' would match by both name and payer id (00000) were it not excluded
    expect(matchCarrierToOptions('Other', '00000', PAYER_OPTIONS)).toEqual({ kind: 'hint', carrierName: 'Other' });
  });

  it('hints (rather than guessing) when a shared payer ID cannot be disambiguated by name', () => {
    const ambiguous = [option('11111', 'MegaCorp HMO'), option('11111', 'MegaCorp PPO')];
    expect(matchCarrierToOptions('MegaCorp', '11111', ambiguous)).toEqual({ kind: 'hint', carrierName: 'MegaCorp' });
  });

  it('hints when the name matches several options', () => {
    const dupes = [option('1', 'Aetna'), option('2', 'AETNA')];
    expect(matchCarrierToOptions('Aetna', null, dupes)).toEqual({ kind: 'hint', carrierName: 'Aetna' });
  });

  it('returns null when the extraction has neither payer nor payer ID', () => {
    expect(matchCarrierToOptions(null, null, PAYER_OPTIONS)).toBeNull();
  });

  it('returns null (no hint possible) for an ID-only extraction that matches nothing', () => {
    expect(matchCarrierToOptions(null, 'ZZZZZ', PAYER_OPTIONS)).toBeNull();
  });
});

describe('matchStateOption', () => {
  it('accepts a two-letter code in any case', () => {
    expect(matchStateOption('ma')).toBe('MA');
    expect(matchStateOption('CO')).toBe('CO');
  });

  it('maps a full state name to its code', () => {
    expect(matchStateOption('Massachusetts')).toBe('MA');
  });

  it('returns null for unrecognized values', () => {
    expect(matchStateOption('Narnia')).toBeNull();
    expect(matchStateOption(null)).toBeNull();
  });
});

describe('normalizeZipForFill', () => {
  it('keeps 5-digit zips and strips the dash from ZIP+4', () => {
    expect(normalizeZipForFill('02139')).toBe('02139');
    expect(normalizeZipForFill('02139-4307')).toBe('021394307');
  });

  it('rejects anything that is not 5 or 9 digits', () => {
    expect(normalizeZipForFill('2139')).toBeNull();
    expect(normalizeZipForFill(null)).toBeNull();
  });
});

describe('mergeInsuranceFields', () => {
  it('only lets the back contribute values the front left null', () => {
    const front = { ...emptyInsuranceFields, payer: 'Aetna', memberId: 'W111' };
    const back = { ...emptyInsuranceFields, memberId: 'W999', rxBin: '610502' };
    expect(mergeInsuranceFields(front, back)).toEqual({
      ...emptyInsuranceFields,
      payer: 'Aetna',
      memberId: 'W111', // front wins
      rxBin: '610502', // back fills the gap
    });
  });

  it('uses the back alone when there is no front extraction', () => {
    const back = { ...emptyInsuranceFields, memberId: 'W999' };
    expect(mergeInsuranceFields(null, back)).toBe(back);
  });
});

describe('buildPhotoIdFills — slot → field mapping', () => {
  it('maps the address fields to the contact-information-page linkIds', () => {
    const fills = buildPhotoIdFills({
      ...emptyPhotoIdFields,
      addressLine1: '123 Main St',
      addressCity: 'Boston',
      addressState: 'Massachusetts',
      addressZip: '02139-4307',
    });
    expect(fills).toEqual([
      { linkId: 'patient-street-address', answer: [{ valueString: '123 Main St' }] },
      { linkId: 'patient-city', answer: [{ valueString: 'Boston' }] },
      { linkId: 'patient-state', answer: [{ valueString: 'MA' }] },
      { linkId: 'patient-zip', answer: [{ valueString: '021394307' }] },
    ]);
  });

  it('never fills name/DOB/sex (pre-paperwork fields) and skips null fields', () => {
    const fills = buildPhotoIdFills({ ...emptyPhotoIdFields, firstName: 'Jane', dateOfBirth: '1990-01-01' });
    expect(fills).toEqual([]);
  });
});

describe('buildInsuranceFills — slot → field mapping', () => {
  const fields = { ...emptyInsuranceFields, payer: 'Aetna', payerId: '60054', memberId: 'W123456' };

  it('maps to the primary carrier/member-id linkIds', () => {
    const { fills, carrierHint } = buildInsuranceFills(fields, PAYER_OPTIONS, 'primary');
    expect(carrierHint).toBeNull();
    expect(fills).toEqual([
      { linkId: 'insurance-member-id', answer: [{ valueString: 'W123456' }] },
      {
        linkId: 'insurance-carrier',
        answer: [{ valueReference: { reference: 'https://rcm-api.zapehr.com/v1/payer/60054', display: 'Aetna' } }],
      },
    ]);
  });

  it('maps to the "-2" linkIds for the secondary ordinal', () => {
    const { fills } = buildInsuranceFills(fields, PAYER_OPTIONS, 'secondary');
    expect(fills.map((fill: { linkId: string }) => fill.linkId)).toEqual([
      'insurance-member-id-2',
      'insurance-carrier-2',
    ]);
  });

  it('surfaces an unmatched carrier as a hint instead of filling', () => {
    const { fills, carrierHint } = buildInsuranceFills(
      { ...emptyInsuranceFields, payer: 'Cigna', memberId: 'W1' },
      PAYER_OPTIONS,
      'primary'
    );
    expect(fills).toEqual([{ linkId: 'insurance-member-id', answer: [{ valueString: 'W1' }] }]);
    expect(carrierHint).toEqual({ linkId: 'insurance-carrier', carrierName: 'Cigna' });
  });

  it('skips carrier matching (fill AND hint) until the payer options have loaded', () => {
    const { fills, carrierHint } = buildInsuranceFills(fields, undefined, 'primary');
    expect(fills).toEqual([{ linkId: 'insurance-member-id', answer: [{ valueString: 'W123456' }] }]);
    expect(carrierHint).toBeNull();
  });
});

describe('isFieldUserEdited — the clobber guard', () => {
  it('is false for an untouched field (empty or prepopulated)', () => {
    expect(isFieldUserEdited({}, {}, 'insurance-member-id')).toBe(false);
    expect(isFieldUserEdited({ 'other-field': { answer: [{ valueString: true }] } }, {}, 'insurance-member-id')).toBe(
      false
    );
  });

  it('is true when any leaf under the field is dirty (user typed via Controller onChange)', () => {
    const dirtyFields = { 'insurance-member-id': { linkId: true, answer: [{ valueString: true }] } };
    expect(isFieldUserEdited(dirtyFields, {}, 'insurance-member-id')).toBe(true);
  });

  it('is true when the field was touched (blur), even if not dirty', () => {
    const touchedFields = { 'patient-city': { answer: [{ valueString: true }] } };
    expect(isFieldUserEdited({}, touchedFields, 'patient-city')).toBe(true);
  });

  it('resolves nested group paths like secondary-insurance.item.2', () => {
    const dirtyFields = {
      'secondary-insurance': { item: [undefined, undefined, { answer: [{ valueReference: true }] }] },
    };
    expect(isFieldUserEdited(dirtyFields, {}, 'secondary-insurance.item.2')).toBe(true);
    expect(isFieldUserEdited(dirtyFields, {}, 'secondary-insurance.item.3')).toBe(false);
  });
});
