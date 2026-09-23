// Box-by-box content of a CMS-1500 (02/12) professional claim form. Values are kept unformatted
// (ISO dates, dollar amounts, plain names) so the renderer can apply the NUCC print conventions
// (upper case, MM DD YY dates, split dollars and cents, no decimal point in diagnosis codes).

export type Cms1500InsuranceType = 'medicare' | 'medicaid' | 'tricare' | 'champva' | 'group' | 'feca' | 'other';

export type Cms1500Relationship = 'self' | 'spouse' | 'child' | 'other';

export type Cms1500Sex = 'M' | 'F';

export interface Cms1500PersonName {
  last: string;
  first: string;
  middle?: string;
  suffix?: string;
}

export interface Cms1500Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface Cms1500DateWithQualifier {
  date: string;
  qualifier?: string;
}

export interface Cms1500Period {
  from?: string;
  to?: string;
}

export interface Cms1500ServiceLine {
  // 24A
  dateFrom?: string;
  dateTo?: string;
  // 24B
  placeOfService?: string;
  // 24C
  emergency?: boolean;
  // 24D
  procedureCode?: string;
  modifiers?: string[];
  // 24E, 1-based positions in diagnosisCodes (1 = A)
  diagnosisPointers?: number[];
  // 24F, in dollars
  charges?: number;
  // 24G
  units?: number;
  // 24H
  epsdt?: string;
  familyPlan?: boolean;
  // 24I / 24J
  renderingProviderNpi?: string;
  renderingProviderOtherIdQualifier?: string;
  renderingProviderOtherId?: string;
  // Shaded area of 24A-24G (e.g. NDC)
  supplementalInformation?: string;
}

export interface Cms1500FormData {
  // Carrier block at the top of the form
  payer?: { name?: string; address?: Cms1500Address };
  // 1
  insuranceType?: Cms1500InsuranceType;
  // 1a
  insuredId?: string;
  // 2
  patientName?: Cms1500PersonName;
  // 3
  patientBirthDate?: string;
  patientSex?: Cms1500Sex;
  // 4
  insuredName?: Cms1500PersonName;
  // 5
  patientAddress?: Cms1500Address;
  patientPhone?: string;
  // 6
  patientRelationshipToInsured?: Cms1500Relationship;
  // 7
  insuredAddress?: Cms1500Address;
  insuredPhone?: string;
  // 9, 9a, 9d
  otherInsuredName?: Cms1500PersonName;
  otherInsuredPolicyOrGroupNumber?: string;
  otherInsuredPlanName?: string;
  // 10a-10c
  conditionRelatedTo?: {
    employment?: boolean;
    autoAccident?: boolean;
    autoAccidentState?: string;
    otherAccident?: boolean;
  };
  // 10d
  claimCodes?: string[];
  // 11
  insuredPolicyGroupNumber?: string;
  // 11a
  insuredBirthDate?: string;
  insuredSex?: Cms1500Sex;
  // 11b
  otherClaimId?: { qualifier?: string; value: string };
  // 11c
  insuredPlanName?: string;
  // 11d
  anotherHealthBenefitPlan?: boolean;
  // 12
  patientSignatureOnFile?: boolean;
  patientSignatureDate?: string;
  // 13
  insuredSignatureOnFile?: boolean;
  // 14
  currentIllnessDate?: Cms1500DateWithQualifier;
  // 15
  otherDate?: Cms1500DateWithQualifier;
  // 16
  unableToWork?: Cms1500Period;
  // 17, 17a, 17b
  referringProvider?: {
    // DN referring, DK ordering, DQ supervising
    qualifier?: string;
    name?: Cms1500PersonName;
    credentials?: string;
    otherIdQualifier?: string;
    otherId?: string;
    npi?: string;
  };
  // 18
  hospitalization?: Cms1500Period;
  // 19
  additionalClaimInformation?: string;
  // 20
  outsideLab?: { purchased: boolean; charges?: number };
  // 21
  icdIndicator?: '9' | '0';
  diagnosisCodes?: string[];
  // 22
  resubmission?: { code?: string; originalReferenceNumber?: string };
  // 23
  priorAuthorizationNumber?: string;
  // 24
  serviceLines: Cms1500ServiceLine[];
  // 25
  federalTaxId?: { value: string; type: 'SSN' | 'EIN' };
  // 26
  patientAccountNumber?: string;
  // 27
  acceptAssignment?: boolean;
  // 29 (28 is always the total of the page's 24F charges)
  amountPaid?: number;
  // 31
  physicianSignature?: string;
  physicianSignatureDate?: string;
  // 32, 32a, 32b
  serviceFacility?: { name?: string; address?: Cms1500Address; npi?: string; otherId?: string };
  // 33, 33a, 33b
  billingProvider?: { name?: string; address?: Cms1500Address; phone?: string; npi?: string; otherId?: string };
}
