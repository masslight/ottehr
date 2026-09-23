import { Cms1500FormData, Cms1500ServiceLine } from '../../../types/data/billing/cms1500.types';
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
import { CMS1500_LAYOUT, Cms1500Box, cms1500BoxName, Cms1500Choice, Cms1500DateField, Cms1500Field } from './layout';

// What one CMS-1500 form says, by box name (see CMS1500_BOXES): the text of each filled-in box, whole
// even when it's longer than the box, and for check boxes the value whose box is marked.
export type Cms1500PageValues = Record<string, string>;

const SIGNATURE_ON_FILE = 'SIGNATURE ON FILE';

class ValueCollector {
  constructor(
    private readonly values: Cms1500PageValues,
    // Service line boxes are named relative to their line, under this prefix.
    private readonly prefix = ''
  ) {}

  private set(box: Cms1500Box, value: string): void {
    this.values[this.prefix + cms1500BoxName(box)] = value;
  }

  put(field: Cms1500Field, value: string | undefined): void {
    const text = toPrintable(value);
    if (text) this.set(field, text);
  }

  mark<T extends string>(choice: Cms1500Choice<T>, value: T | undefined): void {
    if (value) this.set(choice, value);
  }

  yesNo(choice: Cms1500Choice<'yes' | 'no'>, value: boolean | undefined): void {
    if (value != null) this.mark(choice, value ? 'yes' : 'no');
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
export function cms1500PageValues(form: Cms1500FormData): Cms1500PageValues[] {
  const perPage = CMS1500_LAYOUT.serviceLines.count;
  const pages: Cms1500ServiceLine[][] = [];
  for (let i = 0; i < form.serviceLines.length; i += perPage) {
    pages.push(form.serviceLines.slice(i, i + perPage));
  }
  if (!pages.length) pages.push([]);
  return pages.map((lines, index) => pageValues(form, lines, index === 0));
}

function pageValues(
  form: Cms1500FormData,
  serviceLines: Cms1500ServiceLine[],
  isFirstPage: boolean
): Cms1500PageValues {
  const L = CMS1500_LAYOUT;
  const values: Cms1500PageValues = {};
  const out = new ValueCollector(values);

  out.lines(L.carrier, [
    formatAddressLine(form.payer?.name),
    formatAddressLine(form.payer?.address?.line1),
    formatAddressLine(form.payer?.address?.line2),
    formatCityStateZip(form.payer?.address),
  ]);

  // 1-8
  out.mark(L.insuranceType, form.insuranceType);
  out.put(L.insuredId, form.insuredId);
  out.put(L.patientName, formatLastFirstName(form.patientName));
  out.date(L.patientBirthDate, form.patientBirthDate);
  out.mark(L.patientSex, form.patientSex);
  out.put(L.insuredName, formatLastFirstName(form.insuredName));
  out.put(L.patientStreet, formatAddressLine(form.patientAddress?.line1, form.patientAddress?.line2));
  out.put(L.patientCity, formatAddressLine(form.patientAddress?.city));
  out.put(L.patientState, formatAddressLine(form.patientAddress?.state));
  out.put(L.patientZip, zipDigits(form.patientAddress?.postalCode));
  out.phone(L.patientPhone, form.patientPhone);
  out.mark(L.relationship, form.patientRelationshipToInsured);
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
  out.mark(L.insuredSex, form.insuredSex);
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
    const row = new ValueCollector(values, `serviceLines.${i + 1}.`);
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
  });

  // 25-29
  if (form.federalTaxId) {
    out.put(L.federalTaxId, form.federalTaxId.value.replace(/[^0-9A-Za-z]/g, ''));
    out.mark(L.federalTaxIdType, form.federalTaxId.type);
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

  return values;
}
