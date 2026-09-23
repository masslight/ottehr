import { PDFDocument, PrintScaling, rgb, StandardFonts } from 'pdf-lib';
import { Cms1500FormData, Cms1500ServiceLine } from '../../../types/data/billing/cms1500.types';
import { drawCms1500Form } from './form';
import {
  dateParts,
  formatAddressLine,
  formatCityStateZip,
  formatDiagnosisCode,
  formatDiagnosisPointers,
  formatFirstLastName,
  formatLastFirstName,
  formatShortDate,
  formatUnits,
  moneyParts,
  phoneParts,
  toPrintable,
  zipDigits,
} from './format';
import { CMS1500_LAYOUT, CMS1500_PAGE, Cms1500DateField, Cms1500Field } from './layout';

// One value placed on the print grid (see layout.ts).
export interface Cms1500TextRun {
  line: number;
  col: number;
  text: string;
}

export interface Cms1500RenderOptions {
  // Draw the form itself behind the data. Turn it off to print only the data onto pre-printed red forms.
  includeForm?: boolean;
  // Shifts the data to line up with a particular printer, in points (1/72"). Positive values move it
  // right and down.
  offset?: { x: number; y: number };
}

const SIGNATURE_ON_FILE = 'SIGNATURE ON FILE';
// Pica type is 12 pt Courier: 7.2 pt per character is exactly 10 characters per inch.
const DATA_FONT_SIZE = 12;
// Baseline height above the bottom of a print line, which centers capitals on the line.
const BASELINE_RISE = 2.5;

class RunCollector {
  readonly runs: Cms1500TextRun[] = [];

  constructor(private readonly lineOffset = 0) {}

  put(field: Cms1500Field, value: string | undefined): void {
    let text = toPrintable(value);
    if (!text) return;
    if (field.align === 'right') {
      // Amounts are never cut off; a value wider than the field runs into the space to its left.
      this.runs.push({ line: field.line + this.lineOffset, col: field.col + field.width - text.length, text });
      return;
    }
    text = text.slice(0, field.width);
    this.runs.push({ line: field.line + this.lineOffset, col: field.col, text });
  }

  check(field: Cms1500Field, checked: boolean | undefined): void {
    if (checked) this.put(field, 'X');
  }

  yesNo(fields: { yes: Cms1500Field; no: Cms1500Field }, value: boolean | undefined): void {
    if (value == null) return;
    this.check(value ? fields.yes : fields.no, true);
  }

  date(field: Cms1500DateField, value: string | undefined): void {
    const parts = dateParts(value);
    if (!parts) return;
    this.put(field.mm, parts.mm);
    this.put(field.dd, parts.dd);
    this.put(field.year, field.year.width === 2 ? parts.yy : parts.yyyy);
  }

  money(field: { dollars: Cms1500Field; cents: Cms1500Field }, amount: number | undefined): void {
    const parts = moneyParts(amount);
    if (!parts) return;
    this.put(field.dollars, parts.dollars);
    this.put(field.cents, parts.cents);
  }

  phone(field: { areaCode: Cms1500Field; number: Cms1500Field }, value: string | undefined): void {
    const parts = phoneParts(value);
    if (!parts) return;
    this.put(field.areaCode, parts.areaCode);
    this.put(field.number, parts.number);
  }

  // Fills consecutive lines, skipping blank values so the block stays together.
  lines(fields: readonly Cms1500Field[], values: string[]): void {
    values
      .filter(Boolean)
      .slice(0, fields.length)
      .forEach((value, i) => this.put(fields[i], value));
  }
}

// Splits the claim into one form per six service lines. Every form repeats the claim-level items and
// totals only its own lines in item 28; the amount paid (29) is reported once, on the first form.
export function layoutCms1500Pages(form: Cms1500FormData): Cms1500TextRun[][] {
  const perPage = CMS1500_LAYOUT.serviceLines.count;
  const pages: Cms1500ServiceLine[][] = [];
  for (let i = 0; i < form.serviceLines.length; i += perPage) {
    pages.push(form.serviceLines.slice(i, i + perPage));
  }
  if (!pages.length) pages.push([]);
  return pages.map((lines, index) => layoutPage(form, lines, index === 0));
}

function layoutPage(form: Cms1500FormData, serviceLines: Cms1500ServiceLine[], isFirstPage: boolean): Cms1500TextRun[] {
  const L = CMS1500_LAYOUT;
  const out = new RunCollector();

  out.lines(L.carrier, [
    formatAddressLine(form.payer?.name),
    formatAddressLine(form.payer?.address?.line1),
    formatAddressLine(form.payer?.address?.line2),
    formatCityStateZip(form.payer?.address),
  ]);

  // 1-8
  if (form.insuranceType) out.check(L.insuranceType[form.insuranceType], true);
  out.put(L.insuredId, form.insuredId);
  out.put(L.patientName, formatLastFirstName(form.patientName));
  out.date(L.patientBirthDate, form.patientBirthDate);
  if (form.patientSex) out.check(L.patientSex[form.patientSex], true);
  out.put(L.insuredName, formatLastFirstName(form.insuredName));
  out.put(L.patientStreet, formatAddressLine(form.patientAddress?.line1, form.patientAddress?.line2));
  out.put(L.patientCity, formatAddressLine(form.patientAddress?.city));
  out.put(L.patientState, formatAddressLine(form.patientAddress?.state));
  out.put(L.patientZip, zipDigits(form.patientAddress?.postalCode));
  out.phone(L.patientPhone, form.patientPhone);
  if (form.patientRelationshipToInsured) out.check(L.relationship[form.patientRelationshipToInsured], true);
  out.put(L.insuredStreet, formatAddressLine(form.insuredAddress?.line1, form.insuredAddress?.line2));
  out.put(L.insuredCity, formatAddressLine(form.insuredAddress?.city));
  out.put(L.insuredState, formatAddressLine(form.insuredAddress?.state));
  out.put(L.insuredZip, zipDigits(form.insuredAddress?.postalCode));
  out.phone(L.insuredPhone, form.insuredPhone);

  // 9-11: 10a-10c always get a YES or a NO
  out.put(L.otherInsuredName, formatLastFirstName(form.otherInsuredName));
  out.put(L.otherInsuredPolicyOrGroupNumber, form.otherInsuredPolicyOrGroupNumber);
  out.put(L.otherInsuredPlanName, form.otherInsuredPlanName);
  const condition = form.conditionRelatedTo ?? {};
  out.yesNo(L.employment, !!condition.employment);
  out.yesNo(L.autoAccident, !!condition.autoAccident);
  if (condition.autoAccident) out.put(L.autoAccidentState, condition.autoAccidentState);
  out.yesNo(L.otherAccident, !!condition.otherAccident);
  out.put(L.claimCodes, (form.claimCodes ?? []).join(' '));
  out.put(L.insuredPolicyGroupNumber, form.insuredPolicyGroupNumber);
  out.date(L.insuredBirthDate, form.insuredBirthDate);
  if (form.insuredSex) out.check(L.insuredSex[form.insuredSex], true);
  if (form.otherClaimId) {
    out.put(L.otherClaimId.qualifier, form.otherClaimId.qualifier);
    out.put(L.otherClaimId.value, form.otherClaimId.value);
  }
  out.put(L.insuredPlanName, form.insuredPlanName);
  out.yesNo(L.anotherHealthBenefitPlan, form.anotherHealthBenefitPlan);

  // 12, 13
  if (form.patientSignatureOnFile) {
    out.put(L.patientSignature, SIGNATURE_ON_FILE);
    out.put(L.patientSignatureDate, formatShortDate(form.patientSignatureDate));
  }
  if (form.insuredSignatureOnFile) out.put(L.insuredSignature, SIGNATURE_ON_FILE);

  // 14-18
  if (form.currentIllnessDate) {
    out.date(L.currentIllnessDate, form.currentIllnessDate.date);
    out.put(L.currentIllnessDate.qualifier, form.currentIllnessDate.qualifier);
  }
  if (form.otherDate) {
    out.put(L.otherDate.qualifier, form.otherDate.qualifier);
    out.date(L.otherDate, form.otherDate.date);
  }
  out.date(L.unableToWorkFrom, form.unableToWork?.from);
  out.date(L.unableToWorkTo, form.unableToWork?.to);
  const referring = form.referringProvider;
  if (referring) {
    out.put(L.referringProviderQualifier, referring.qualifier);
    out.put(L.referringProviderName, formatFirstLastName(referring.name, referring.credentials));
    out.put(L.referringProviderOtherId.qualifier, referring.otherIdQualifier);
    out.put(L.referringProviderOtherId.value, referring.otherId);
    out.put(L.referringProviderNpi, referring.npi);
  }
  out.date(L.hospitalizationFrom, form.hospitalization?.from);
  out.date(L.hospitalizationTo, form.hospitalization?.to);

  // 19-23: 20 is NO unless the claim reports purchased services
  out.put(L.additionalClaimInformation, form.additionalClaimInformation);
  out.yesNo(L.outsideLab, !!form.outsideLab?.purchased);
  if (form.outsideLab?.purchased) out.money(L.outsideLabCharges, form.outsideLab.charges);
  const diagnosisCodes = (form.diagnosisCodes ?? []).map(formatDiagnosisCode).filter(Boolean).slice(0, 12);
  if (diagnosisCodes.length) out.put(L.icdIndicator, form.icdIndicator ?? '0');
  diagnosisCodes.forEach((code, i) => out.put(L.diagnosisCodes[i], code));
  out.put(L.resubmissionCode, form.resubmission?.code);
  out.put(L.originalReferenceNumber, form.resubmission?.originalReferenceNumber);
  out.put(L.priorAuthorizationNumber, form.priorAuthorizationNumber);

  // 24
  const SL = L.serviceLines;
  serviceLines.forEach((line, i) => {
    const row = new RunCollector(SL.firstLine + i * SL.lineStep);
    // With a single date of service the "To" date repeats the "From" date.
    row.date(SL.dateFrom, line.dateFrom);
    row.date(SL.dateTo, line.dateTo ?? line.dateFrom);
    row.put(SL.placeOfService, line.placeOfService);
    row.put(SL.emergency, line.emergency ? 'Y' : undefined);
    row.put(SL.procedureCode, line.procedureCode);
    (line.modifiers ?? []).slice(0, SL.modifiers.length).forEach((modifier, m) => row.put(SL.modifiers[m], modifier));
    row.put(SL.diagnosisPointer, formatDiagnosisPointers(line.diagnosisPointers));
    row.money(SL.charges, line.charges);
    row.put(SL.units, formatUnits(line.units));
    row.put(SL.familyPlan, line.familyPlan ? 'Y' : undefined);
    row.put(SL.renderingProviderNpi, line.renderingProviderNpi);
    row.put(SL.supplementalInformation, line.supplementalInformation);
    row.put(SL.epsdt, line.epsdt);
    row.put(SL.renderingProviderOtherIdQualifier, line.renderingProviderOtherIdQualifier);
    row.put(SL.renderingProviderOtherId, line.renderingProviderOtherId);
    out.runs.push(...row.runs);
  });

  // 25-29
  if (form.federalTaxId) {
    out.put(L.federalTaxId, form.federalTaxId.value.replace(/[^0-9A-Za-z]/g, ''));
    out.check(L.federalTaxIdType[form.federalTaxId.type], true);
  }
  out.put(L.patientAccountNumber, form.patientAccountNumber);
  out.yesNo(L.acceptAssignment, form.acceptAssignment);
  if (serviceLines.length) {
    out.money(
      L.totalCharge,
      serviceLines.reduce((sum, line) => sum + (line.charges ?? 0), 0)
    );
  }
  if (isFirstPage) out.money(L.amountPaid, form.amountPaid);

  // 31-33
  out.put(L.physicianSignature, form.physicianSignature);
  out.put(L.physicianSignatureDate, formatShortDate(form.physicianSignatureDate));
  const facility = form.serviceFacility;
  out.lines(L.serviceFacility, [
    formatAddressLine(facility?.name),
    formatAddressLine(facility?.address?.line1, facility?.address?.line2),
    formatCityStateZip(facility?.address),
  ]);
  out.put(L.serviceFacilityNpi, facility?.npi);
  out.put(L.serviceFacilityOtherId, facility?.otherId);
  const billing = form.billingProvider;
  out.phone(L.billingProviderPhone, billing?.phone);
  out.lines(L.billingProvider, [
    formatAddressLine(billing?.name),
    formatAddressLine(billing?.address?.line1, billing?.address?.line2),
    formatCityStateZip(billing?.address),
  ]);
  out.put(L.billingProviderNpi, billing?.npi);
  out.put(L.billingProviderOtherId, billing?.otherId);

  return out.runs;
}

// Renders each claim as one or more CMS-1500 pages in a single PDF.
export async function renderCms1500Pdf(
  forms: Cms1500FormData[],
  options: Cms1500RenderOptions = {}
): Promise<Uint8Array> {
  const { includeForm = true, offset = { x: 0, y: 0 } } = options;
  const doc = await PDFDocument.create();
  doc.setTitle('CMS-1500 Health Insurance Claim Form');
  // Pre-printed forms only line up when the PDF prints at actual size.
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  const dataFont = await doc.embedFont(StandardFonts.Courier);
  const formFonts = includeForm
    ? {
        regular: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold),
        italic: await doc.embedFont(StandardFonts.HelveticaOblique),
        boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
      }
    : undefined;

  for (const form of forms) {
    for (const runs of layoutCms1500Pages(form)) {
      const page = doc.addPage([CMS1500_PAGE.width, CMS1500_PAGE.height]);
      if (formFonts) drawCms1500Form(page, formFonts);
      for (const run of runs) {
        page.drawText(run.text, {
          x: (run.col - 1) * CMS1500_PAGE.columnWidth + offset.x,
          y: CMS1500_PAGE.height - run.line * CMS1500_PAGE.lineHeight + BASELINE_RISE - offset.y,
          size: DATA_FONT_SIZE,
          font: dataFont,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
  return doc.save();
}
