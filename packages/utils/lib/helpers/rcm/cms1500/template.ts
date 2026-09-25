import {
  PDFArray,
  PDFBool,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFForm,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFTextField,
  PrintScaling,
  StandardFonts,
} from 'pdf-lib';
import { Cms1500FormData } from '../../../types/data/billing/cms1500.types';
import { CMS1500_LAYOUT } from './layout';
import { Cms1500PageValues, cms1500PageValues } from './values';

// Fills in cms1500-template.pdf, a fillable CMS-1500 (02/12) built by scripts/prepare-cms1500-template.ts.
// Every box stays an editable field, so anything that's cut off or in the wrong place can be fixed by
// hand before printing.

// The template's text fields and the box (see CMS1500_BOXES) each one shows
const TEXT_FIELDS: Record<string, string> = {
  insurance_name: 'carrier.1',
  insurance_address: 'carrier.2',
  insurance_address2: 'carrier.3',
  insurance_city_state_zip: 'carrier.4',
  insurance_id: 'insuredId',
  pt_name: 'patientName',
  birth_mm: 'patientBirthDate.mm',
  birth_dd: 'patientBirthDate.dd',
  birth_yy: 'patientBirthDate.year',
  ins_name: 'insuredName',
  pt_street: 'patientStreet',
  pt_city: 'patientCity',
  pt_state: 'patientState',
  pt_zip: 'patientZip',
  pt_AreaCode: 'patientPhone.areaCode',
  pt_phone: 'patientPhone.number',
  ins_street: 'insuredStreet',
  ins_city: 'insuredCity',
  ins_state: 'insuredState',
  ins_zip: 'insuredZip',
  'ins_phone area': 'insuredPhone.areaCode',
  ins_phone: 'insuredPhone.number',
  other_ins_name: 'otherInsuredName',
  other_ins_policy: 'otherInsuredPolicyOrGroupNumber',
  other_ins_plan_name: 'otherInsuredPlanName',
  accident_place: 'autoAccidentState',
  '50': 'claimCodes',
  ins_policy: 'insuredPolicyGroupNumber',
  ins_dob_mm: 'insuredBirthDate.mm',
  ins_dob_dd: 'insuredBirthDate.dd',
  ins_dob_yy: 'insuredBirthDate.year',
  '57': 'otherClaimId.qualifier',
  '58': 'otherClaimId.value',
  ins_plan_name: 'insuredPlanName',
  pt_signature: 'patientSignature',
  pt_date: 'patientSignatureDate',
  ins_signature: 'insuredSignature',
  cur_ill_mm: 'currentIllnessDate.mm',
  cur_ill_dd: 'currentIllnessDate.dd',
  cur_ill_yy: 'currentIllnessDate.year',
  '73': 'currentIllnessDate.qualifier',
  '74': 'otherDate.qualifier',
  sim_ill_mm: 'otherDate.mm',
  sim_ill_dd: 'otherDate.dd',
  sim_ill_yy: 'otherDate.year',
  work_mm_from: 'unableToWorkFrom.mm',
  work_dd_from: 'unableToWorkFrom.dd',
  work_yy_from: 'unableToWorkFrom.year',
  work_mm_end: 'unableToWorkTo.mm',
  work_dd_end: 'unableToWorkTo.dd',
  work_yy_end: 'unableToWorkTo.year',
  '85': 'referringProviderQualifier',
  ref_physician: 'referringProviderName',
  'physician number 17a1': 'referringProviderOtherId.qualifier',
  'physician number 17a': 'referringProviderOtherId.value',
  id_physician: 'referringProviderNpi',
  hosp_mm_from: 'hospitalizationFrom.mm',
  hosp_dd_from: 'hospitalizationFrom.dd',
  hosp_yy_from: 'hospitalizationFrom.year',
  hosp_mm_end: 'hospitalizationTo.mm',
  hosp_dd_end: 'hospitalizationTo.dd',
  hosp_yy_end: 'hospitalizationTo.year',
  '96': 'additionalClaimInformation',
  '99icd': 'icdIndicator',
  ...Object.fromEntries(CMS1500_LAYOUT.diagnosisCodes.map((_, i) => [`diagnosis${i + 1}`, `diagnosisCodes.${i + 1}`])),
  medicaid_resub: 'resubmissionCode',
  original_ref: 'originalReferenceNumber',
  prior_auth: 'priorAuthorizationNumber',
  ...serviceLineFields(),
  tax_id: 'federalTaxId',
  pt_account: 'patientAccountNumber',
  physician_signature: 'physicianSignature',
  physician_date: 'physicianSignatureDate',
  fac_name: 'serviceFacility.1',
  fac_street: 'serviceFacility.2',
  fac_location: 'serviceFacility.3',
  pin1: 'serviceFacilityNpi',
  grp1: 'serviceFacilityOtherId',
  'doc_phone area': 'billingProviderPhone.areaCode',
  doc_phone: 'billingProviderPhone.number',
  doc_name: 'billingProvider.1',
  doc_street: 'billingProvider.2',
  doc_location: 'billingProvider.3',
  pin: 'billingProviderNpi',
  grp: 'billingProviderOtherId',
};

// 24A-24J. The template calls the 24C EMG field "type" and the shaded 24I qualifier "emg".
function serviceLineFields(): Record<string, string> {
  const supplemental = ['Suppl', 'Suppla', 'Supplb', 'Supplc', 'Suppld', 'Supple'];
  return Object.fromEntries(
    supplemental.flatMap((supplementalField, i) => {
      const n = i + 1;
      const line = `serviceLines.${n}`;
      return [
        [`sv${n}_mm_from`, `${line}.dateFrom.mm`],
        [`sv${n}_dd_from`, `${line}.dateFrom.dd`],
        [`sv${n}_yy_from`, `${line}.dateFrom.year`],
        [`sv${n}_mm_end`, `${line}.dateTo.mm`],
        [`sv${n}_dd_end`, `${line}.dateTo.dd`],
        [`sv${n}_yy_end`, `${line}.dateTo.year`],
        [`place${n}`, `${line}.placeOfService`],
        [`type${n}`, `${line}.emergency`],
        [`cpt${n}`, `${line}.procedureCode`],
        [`mod${n}`, `${line}.modifiers.1`],
        [`mod${n}a`, `${line}.modifiers.2`],
        [`mod${n}b`, `${line}.modifiers.3`],
        [`mod${n}c`, `${line}.modifiers.4`],
        [`diag${n}`, `${line}.diagnosisPointer`],
        [`day${n}`, `${line}.units`],
        [`plan${n}`, `${line}.familyPlan`],
        [`local${n}`, `${line}.renderingProviderNpi`],
        [supplementalField, `${line}.supplementalInformation`],
        [`epsdt${n}`, `${line}.epsdt`],
        [`emg${n}`, `${line}.renderingProviderOtherIdQualifier`],
        [`local${n}a`, `${line}.renderingProviderOtherId`],
      ];
    })
  );
}

// Amounts are a single right-aligned field each, over the dollars, the dotted divider and the cents.
const AMOUNT_FIELDS: Record<string, string> = {
  charge: 'outsideLabCharges',
  ...Object.fromEntries(
    Array.from({ length: CMS1500_LAYOUT.serviceLines.count }, (_, i) => [`ch${i + 1}`, `serviceLines.${i + 1}.charges`])
  ),
  t_charge: 'totalCharge',
  amt_paid: 'amountPaid',
};
// Keeps the dollars left of the divider, with the cents to its right.
const DOLLARS_CENTS_GAP = '  ';

const YES_NO = { yes: 'YES', no: 'NO' };

// The template's check box fields, each with one widget per choice: the box, and the widget's on
// state for each of its values
const CHECK_BOX_FIELDS: Record<string, { box: string; states: Record<string, string> }> = {
  insurance_type: {
    box: 'insuranceType',
    states: {
      medicare: 'Medicare',
      medicaid: 'Medicaid',
      tricare: 'Tricare',
      champva: 'Champva',
      group: 'Group',
      feca: 'Feca',
      other: 'Other',
    },
  },
  sex: { box: 'patientSex', states: { M: 'M', F: 'F' } },
  rel_to_ins: { box: 'relationship', states: { self: 'S', spouse: 'M', child: 'C', other: 'O' } },
  employment: { box: 'employment', states: YES_NO },
  pt_auto_accident: { box: 'autoAccident', states: YES_NO },
  other_accident: { box: 'otherAccident', states: YES_NO },
  ins_sex: { box: 'insuredSex', states: { M: 'MALE', F: 'FEMALE' } },
  ins_benefit_plan: { box: 'anotherHealthBenefitPlan', states: YES_NO },
  lab: { box: 'outsideLab', states: YES_NO },
  ssn: { box: 'federalTaxIdType', states: { SSN: 'SSN', EIN: 'EIN' } },
  assignment: { box: 'acceptAssignment', states: YES_NO },
};

interface Fonts {
  helvetica: PDFFont;
  courier: PDFFont;
}

export interface Cms1500FillOptions {
  // The date next to the signature on file in item 31 (YYYY-MM-DD); today if not given.
  signedOn?: string;
}

// Renders each claim as one or more filled-in CMS-1500 forms in a single PDF.
export async function fillCms1500Template(
  template: ArrayBuffer | Uint8Array,
  forms: Cms1500FormData[],
  options: Cms1500FillOptions = {}
): Promise<Uint8Array> {
  const [first = {}, ...more] = forms.flatMap((form) => cms1500PageValues(form, options.signedOn));
  const doc = await PDFDocument.load(template);
  doc.setTitle('CMS-1500 Health Insurance Claim Form');
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const fonts = await embedFonts(doc);
  fillForm(doc.getForm(), first, fonts);
  for (const [i, values] of more.entries()) {
    await addForm(doc, template, values, `page${i + 2}`);
  }

  const acroForm = doc.getForm().acroForm;
  // The template has no default resources, which viewers need to find the fonts the fields name when
  // someone types in them; blank fields still name the template's ArialMT, drawn as Helvetica. Every
  // field now has its appearance, so viewers needn't redraw them.
  const { helvetica, courier } = fonts;
  acroForm.dict.set(
    PDFName.of('DR'),
    doc.context.obj({ Font: { [helvetica.name]: helvetica.ref, ArialMT: helvetica.ref, [courier.name]: courier.ref } })
  );
  acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.False);
  return doc.save({ updateFieldAppearances: false });
}

async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  return {
    helvetica: await doc.embedFont(StandardFonts.Helvetica),
    courier: await doc.embedFont(StandardFonts.Courier),
  };
}

function fillForm(form: PDFForm, values: Cms1500PageValues, fonts: Fonts): void {
  const fill = (name: string, text: string | undefined): void => {
    if (!text) return;
    const field = form.getTextField(name);
    const maxLength = field.getMaxLength();
    field.setText(maxLength === undefined ? text : text.slice(0, maxLength));
    field.updateAppearances(fontFor(field, fonts));
  };
  Object.entries(TEXT_FIELDS).forEach(([name, box]) => fill(name, values[box]));
  Object.entries(AMOUNT_FIELDS).forEach(([name, box]) => {
    const dollars = values[`${box}.dollars`];
    if (dollars) fill(name, `${dollars}${DOLLARS_CENTS_GAP}${values[`${box}.cents`]}`);
  });
  Object.entries(CHECK_BOX_FIELDS).forEach(([name, { box, states }]) => {
    const state = states[values[box]];
    if (state) check(form.getCheckBox(name), state);
  });
}

// The fields keep the template's font sizes, in its fonts: Courier where it asks for it, Helvetica
// (metrically the same as Arial) everywhere else.
function fontFor(field: PDFTextField, fonts: Fonts): PDFFont {
  return field.acroField.getDefaultAppearance()?.includes('/Cour') ? fonts.courier : fonts.helvetica;
}

// pdf-lib's check() only knows the first widget's on state, so set the value and each widget's state
// directly.
function check(field: PDFCheckBox, state: string): void {
  const on = PDFName.of(state);
  field.acroField.dict.set(PDFName.of('V'), on);
  field.acroField
    .getWidgets()
    .forEach((widget) => widget.setAppearanceState(widget.getOnValue() === on ? on : PDFName.of('Off')));
}

// Adds a continuation form: another copy of the template's fields, grouped under `name` so their values
// stay apart from the other forms', over the first page's form image.
async function addForm(
  doc: PDFDocument,
  template: ArrayBuffer | Uint8Array,
  values: Cms1500PageValues,
  name: string
): Promise<void> {
  const copy = await PDFDocument.load(template);
  fillForm(copy.getForm(), values, await embedFonts(copy));

  const acroForm = copy.getForm().acroForm;
  const fields = acroForm.dict.lookup(PDFName.of('Fields'), PDFArray);
  const group = copy.context.register(copy.context.obj({ T: PDFHexString.fromText(name), Kids: fields }));
  fields.asArray().forEach((ref) => copy.context.lookup(ref, PDFDict).set(PDFName.of('Parent'), group));
  acroForm.dict.set(PDFName.of('Fields'), copy.context.obj([group]));

  // Copy only the fields; the new page reuses the first page's content rather than another copy of the
  // image.
  const content = [PDFName.of('Contents'), PDFName.of('Resources')];
  content.forEach((key) => copy.getPage(0).node.delete(key));
  const [page] = await doc.copyPages(copy, [0]);
  const firstPage = doc.getPage(0).node;
  content.forEach((key) => {
    const value = firstPage.get(key);
    if (value) page.node.set(key, value);
  });
  doc.addPage(page);

  // The copied group is where the copied fields' parents lead.
  let ref = page.node.Annots()?.get(0);
  for (let parent = lookupParent(doc, ref); parent; parent = lookupParent(doc, ref)) ref = parent;
  if (!(ref instanceof PDFRef)) throw new Error(`Could not find the fields of ${name}`);
  doc.getForm().acroForm.addField(ref);
}

function lookupParent(doc: PDFDocument, ref: unknown): PDFRef | undefined {
  if (!(ref instanceof PDFRef)) return undefined;
  const parent = doc.context.lookup(ref, PDFDict).get(PDFName.of('Parent'));
  return parent instanceof PDFRef ? parent : undefined;
}
