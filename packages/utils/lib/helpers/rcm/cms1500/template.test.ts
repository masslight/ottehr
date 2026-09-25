import { readFileSync } from 'fs';
import { PDFCheckBox, PDFDict, PDFDocument, PDFName, PDFTextField } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { Cms1500FormData, Cms1500ServiceLine } from '../../../types/data/billing/cms1500.types';
import { CMS1500_BOXES } from './layout';
import { fillCms1500Template } from './template';
import { cms1500PageValues } from './values';

const template = readFileSync(new URL('./cms1500-template.pdf', import.meta.url));

const serviceLine = (overrides: Partial<Cms1500ServiceLine> = {}): Cms1500ServiceLine => ({
  dateFrom: '2026-09-01',
  dateTo: '2026-09-03',
  placeOfService: '11',
  emergency: true,
  procedureCode: '99213',
  modifiers: ['25', 'GT', '59', 'XU'],
  diagnosisPointers: [1, 2],
  charges: 150,
  units: 1,
  epsdt: 'AV',
  familyPlan: true,
  renderingProviderNpi: '1987654329',
  renderingProviderOtherIdQualifier: 'ZZ',
  renderingProviderOtherId: '207Q00000X',
  supplementalInformation: 'N400409123401 UN1',
  ...overrides,
});

const address = { line1: '123 N. Main Street', line2: 'Apt 4B', city: 'Boston', state: 'MA', postalCode: '02110' };

// A claim with something for every box on the form
const claim: Cms1500FormData = {
  payer: { name: 'Aetna', address },
  insuranceType: 'group',
  insuredId: 'W123456789',
  patientName: { last: 'Doe', first: 'Jane', middle: 'Alice' },
  patientBirthDate: '1980-01-15',
  patientSex: 'F',
  patientAddress: address,
  patientPhone: '(617) 555-1234',
  patientRelationshipToInsured: 'spouse',
  insuredName: { last: 'Doe', first: 'John' },
  insuredAddress: address,
  insuredPhone: '617-555-9876',
  otherInsuredName: { last: 'Doe', first: 'Jane' },
  otherInsuredPolicyOrGroupNumber: 'GRP998877',
  otherInsuredPlanName: 'Blue Cross Blue Shield',
  conditionRelatedTo: { employment: false, autoAccident: true, autoAccidentState: 'MA', otherAccident: false },
  claimCodes: ['AA'],
  insuredPolicyGroupNumber: 'GRP-445566',
  insuredBirthDate: '1978-06-30',
  insuredSex: 'M',
  otherClaimId: { qualifier: 'Y4', value: 'AGENCY12345' },
  insuredPlanName: 'Aetna Choice POS II',
  anotherHealthBenefitPlan: true,
  patientSignatureOnFile: true,
  patientSignatureDate: '2026-09-01',
  insuredSignatureOnFile: true,
  currentIllnessDate: { date: '2026-08-28', qualifier: '431' },
  otherDate: { date: '2026-08-27', qualifier: '439' },
  unableToWork: { from: '2026-08-28', to: '2026-09-04' },
  referringProvider: {
    qualifier: 'DN',
    name: { first: 'Gregory', last: 'House' },
    credentials: 'MD',
    otherIdQualifier: 'G2',
    otherId: 'REF7788',
    npi: '1234567893',
  },
  hospitalization: { from: '2026-08-28', to: '2026-08-30' },
  additionalClaimInformation: 'Initial visit after accident',
  outsideLab: { purchased: true, charges: 45 },
  icdIndicator: '0',
  diagnosisCodes: [
    'S82.101A',
    'J06.9',
    'R05.9',
    'M54.50',
    'Z23',
    'E11.9',
    'I10',
    'R51.9',
    'K21.9',
    'F41.1',
    'G43.909',
    'N39.0',
  ],
  resubmission: { code: '7', originalReferenceNumber: '2026123456789' },
  priorAuthorizationNumber: 'PA-2026-0042',
  serviceLines: Array.from({ length: 6 }, (_, i) => serviceLine({ charges: 100 * (i + 1) + 0.5 })),
  federalTaxId: { value: '12-3456789', type: 'EIN' },
  patientAccountNumber: 'ACCT-000123',
  acceptAssignment: true,
  amountPaid: 40,
  physicianSignature: 'SIGNATURE ON FILE',
  serviceFacility: { name: 'Ottehr Urgent Care', address, npi: '1122334455', otherId: 'X4CLIA12D3456' },
  billingProvider: {
    name: 'Ottehr Medical Group',
    address,
    phone: '617-555-0000',
    npi: '1098765432',
    otherId: 'ZZ261QU0200X',
  },
};

const fill = async (forms: Cms1500FormData[]): Promise<PDFDocument> =>
  PDFDocument.load(await fillCms1500Template(template, forms));

// The template's blank fields hold an empty value
const text = (doc: PDFDocument, name: string): string => doc.getForm().getTextField(name).getText() ?? '';

// The check box's value, from the widget that's on
const checked = (field: PDFCheckBox): string | undefined =>
  field.acroField
    .getWidgets()
    .find((widget) => widget.getAppearanceState() !== PDFName.of('Off'))
    ?.getOnValue()
    ?.decodeText();

describe('fillCms1500Template', () => {
  it('puts every box of the claim into a field of the template', async () => {
    const [values] = cms1500PageValues(claim);
    expect(Object.keys(values).sort()).toEqual(CMS1500_BOXES.map(({ name }) => name).sort());

    const fields = (await fill([claim])).getForm().getFields();
    const filled = fields.filter((field) => field instanceof PDFTextField && field.getText());
    const marked = fields.filter((field) => field instanceof PDFCheckBox && checked(field));
    const checkBoxBoxes = CMS1500_BOXES.filter(({ box }) => 'cols' in box).length;
    // Amounts show their dollars and cents in one field.
    const amounts = CMS1500_BOXES.filter(({ name }) => name.endsWith('.cents')).length;
    expect(marked).toHaveLength(checkBoxBoxes);
    expect(filled).toHaveLength(CMS1500_BOXES.length - checkBoxBoxes - amounts);
  });

  it('fills in the text fields and marks the check boxes', async () => {
    const doc = await fill([claim]);
    expect(text(doc, 'pt_name')).toBe('DOE, JANE, A');
    expect([text(doc, 'birth_mm'), text(doc, 'birth_dd'), text(doc, 'birth_yy')]).toEqual(['01', '15', '1980']);
    expect(text(doc, 'cpt6')).toBe('99213');
    expect(text(doc, 'doc_location')).toBe('BOSTON MA 02110');
    const form = doc.getForm();
    expect(checked(form.getCheckBox('insurance_type'))).toBe('Group');
    expect(checked(form.getCheckBox('rel_to_ins'))).toBe('M');
    expect(checked(form.getCheckBox('ins_sex'))).toBe('MALE');
    expect(checked(form.getCheckBox('ssn'))).toBe('EIN');
    expect(form.getCheckBox('insurance_type').acroField.dict.get(PDFName.of('V'))).toBe(PDFName.of('Group'));
  });

  it('dates the signature on file with the day the form is produced', async () => {
    const doc = await PDFDocument.load(await fillCms1500Template(template, [claim], { signedOn: '2026-09-25' }));
    expect(text(doc, 'physician_signature')).toBe('SIGNATURE ON FILE');
    expect(text(doc, 'physician_date')).toBe('09 25 26');
  });

  it('writes amounts with the dollars and cents on either side of the divider', async () => {
    const doc = await fill([claim]);
    expect(text(doc, 'ch1')).toBe('100  50');
    expect(text(doc, 't_charge')).toBe('2103  00');
    expect(text(doc, 'amt_paid')).toBe('40  00');
    expect(text(doc, 'charge')).toBe('45  00');
  });

  it('cuts values off at the length a field allows', async () => {
    const doc = await fill([{ ...claim, claimCodes: ['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH'] }]);
    expect(text(doc, '50')).toBe('AA BB CC DD EE FF G');
  });

  it('leaves every field editable, drawn with fonts viewers can find', async () => {
    const doc = await fill([claim]);
    const form = doc.getForm();
    expect(form.getFields()).toHaveLength(244);
    expect(form.getFields().filter((field) => field.isReadOnly())).toHaveLength(0);
    expect(form.acroForm.dict.get(PDFName.of('NeedAppearances'))?.toString()).toBe('false');
    const fonts = form.acroForm.dict.lookup(PDFName.of('DR'), PDFDict).lookup(PDFName.of('Font'), PDFDict);
    expect(fonts.keys().map(String).sort()).toEqual(['/ArialMT', '/Courier', '/Helvetica']);
    expect(form.getTextField('pt_name').acroField.getDefaultAppearance()).toContain('/Helvetica 10 Tf');
  });

  it('continues past six service lines on another copy of the form with its own fields', async () => {
    const serviceLines = Array.from({ length: 8 }, (_, i) => serviceLine({ charges: 10 * (i + 1) }));
    const doc = await fill([{ ...claim, serviceLines }]);
    expect(doc.getPageCount()).toBe(2);
    expect(text(doc, 't_charge')).toBe('210  00');
    expect(text(doc, 'page2.pt_name')).toBe('DOE, JANE, A');
    expect(text(doc, 'page2.ch1')).toBe('70  00');
    expect(text(doc, 'page2.ch3')).toBe('');
    expect(text(doc, 'page2.t_charge')).toBe('150  00');
    expect(text(doc, 'page2.amt_paid')).toBe('');
    expect(checked(doc.getForm().getCheckBox('page2.insurance_type'))).toBe('Group');
    // The second page draws the first page's form image rather than a copy of it.
    const image = (page: number): unknown =>
      doc.getPage(page).node.Resources()?.lookup(PDFName.of('XObject'), PDFDict).get(PDFName.of('Fm1'));
    expect(image(1)).toBe(image(0));
  });
});

describe('cms1500-template.pdf', () => {
  it('is the one-page claim form without the vendor extras', async () => {
    const doc = await PDFDocument.load(template);
    expect(doc.getPageCount()).toBe(1);
    const names = doc
      .getForm()
      .getFields()
      .map((field) => field.getName());
    expect(names).not.toContain('Clear Form');
    expect(names).not.toContain('276');
    const annots = doc.getPage(0).node.Annots()?.asArray() ?? [];
    const subtypes = annots.map((ref) => doc.context.lookup(ref, PDFDict).get(PDFName.of('Subtype')));
    expect(subtypes.every((subtype) => subtype === PDFName.of('Widget'))).toBe(true);
  });
});
