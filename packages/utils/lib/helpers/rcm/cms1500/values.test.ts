import { describe, expect, it } from 'vitest';
import { Cms1500FormData, Cms1500ServiceLine } from '../../../types/data/billing/cms1500.types';
import { cms1500PageValues } from './values';

const serviceLine = (overrides: Partial<Cms1500ServiceLine> = {}): Cms1500ServiceLine => ({
  dateFrom: '2026-09-01',
  placeOfService: '11',
  procedureCode: '99213',
  modifiers: ['25'],
  diagnosisPointers: [1, 2],
  charges: 150,
  units: 1,
  renderingProviderNpi: '1987654329',
  ...overrides,
});

const form: Cms1500FormData = {
  insuranceType: 'group',
  insuredId: 'W123456789',
  patientName: { last: 'Doe', first: 'Jane', middle: 'Alice' },
  patientBirthDate: '1980-01-15',
  patientSex: 'F',
  patientRelationshipToInsured: 'self',
  diagnosisCodes: ['J06.9', 'R05.9'],
  serviceLines: [serviceLine()],
  federalTaxId: { value: '12-3456789', type: 'EIN' },
  acceptAssignment: true,
  amountPaid: 25,
};

describe('cms1500PageValues', () => {
  it('fills in each box the claim has a value for', () => {
    const [page] = cms1500PageValues(form);
    expect(page).toMatchObject({
      insuranceType: 'group',
      insuredId: 'W123456789',
      patientName: 'DOE, JANE, A',
      'patientBirthDate.mm': '01',
      'patientBirthDate.dd': '15',
      'patientBirthDate.year': '1980',
      patientSex: 'F',
      relationship: 'self',
      icdIndicator: '0',
      'diagnosisCodes.1': 'J069',
      'diagnosisCodes.2': 'R059',
      federalTaxId: '123456789',
      federalTaxIdType: 'EIN',
      acceptAssignment: 'yes',
    });
    expect(page.insuredName).toBeUndefined();
  });

  it('answers NO to the condition and outside lab questions unless the claim says otherwise', () => {
    const [page] = cms1500PageValues(form);
    expect([page.employment, page.autoAccident, page.otherAccident, page.outsideLab]).toEqual(['no', 'no', 'no', 'no']);

    const [accident] = cms1500PageValues({
      ...form,
      conditionRelatedTo: { autoAccident: true, autoAccidentState: 'MA' },
    });
    expect(accident.autoAccident).toBe('yes');
    expect(accident.autoAccidentState).toBe('MA');
  });

  it('fills a service line, repeating the From date as the To date', () => {
    const [page] = cms1500PageValues({ ...form, serviceLines: [serviceLine({ charges: 1234.5 })] });
    expect(page).toMatchObject({
      'serviceLines.1.dateFrom.mm': '09',
      'serviceLines.1.dateFrom.dd': '01',
      'serviceLines.1.dateFrom.year': '26',
      'serviceLines.1.dateTo.year': '26',
      'serviceLines.1.placeOfService': '11',
      'serviceLines.1.procedureCode': '99213',
      'serviceLines.1.modifiers.1': '25',
      'serviceLines.1.diagnosisPointer': 'AB',
      'serviceLines.1.charges.dollars': '1234',
      'serviceLines.1.charges.cents': '50',
      'serviceLines.1.units': '1',
      'serviceLines.1.renderingProviderNpi': '1987654329',
      // 28: total of the form's lines
      'totalCharge.dollars': '1234',
      'totalCharge.cents': '50',
    });
  });

  it('continues past six service lines on another form with its own total', () => {
    const lines = Array.from({ length: 7 }, (_, i) => serviceLine({ charges: 10 * (i + 1) }));
    const pages = cms1500PageValues({ ...form, serviceLines: lines });
    expect(pages).toHaveLength(2);
    // 10 + 20 + ... + 60 on the first form, 70 on the second
    expect(pages[0]['totalCharge.dollars']).toBe('210');
    expect(pages[1]['totalCharge.dollars']).toBe('70');
    expect(pages[1]['serviceLines.1.charges.dollars']).toBe('70');
    expect(pages[1]['serviceLines.2.procedureCode']).toBeUndefined();
    // The amount paid is reported once, and the claim-level items repeat.
    expect(pages[0]['amountPaid.dollars']).toBe('25');
    expect(pages[1]['amountPaid.dollars']).toBeUndefined();
    expect(pages[1].patientName).toBe('DOE, JANE, A');
  });

  it('still produces one form for a claim without service lines', () => {
    const pages = cms1500PageValues({ ...form, serviceLines: [] });
    expect(pages).toHaveLength(1);
    expect(pages[0]['totalCharge.dollars']).toBeUndefined();
  });

  it('keeps values whole even when they are longer than their box', () => {
    const [page] = cms1500PageValues({ ...form, patientName: { last: 'Wolfeschlegelsteinhausen', first: 'Hubert' } });
    expect(page.patientName).toBe('WOLFESCHLEGELSTEINHAUSEN, HUBERT');
  });
});
