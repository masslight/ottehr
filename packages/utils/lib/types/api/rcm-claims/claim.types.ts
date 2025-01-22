import {
  Appointment,
  ChargeItem,
  Claim,
  Coverage,
  CoverageEligibilityResponse,
  InsurancePlan,
  Location,
  Patient,
  Period,
  Practitioner,
} from 'fhir/r4b';
import { StateType } from 'utils';

export interface ClaimsQueueGetResponse {
  items: ClaimsQueueItem[];
  offset: number;
  count: number;
}

export interface ClaimsQueueGetRequest {
  patient?: string;
  visitId?: string;
  claimId?: string;
  teamMember?: string;
  queue?: string;
  dayInQueue?: number;
  status?: ClaimsQueueItemStatus;
  state?: StateType;
  facilityGroup?: string;
  facility?: string;
  insurance?: string;
  balance?: number;
  dosFrom?: string;
  dosTo?: string;
  offset?: number;
  pageSize?: number;
}

export const ClaimsQueueItemStatuses = [
  'open',
  'locked',
  'returned-billing',
  'returned-coding',
  'sent',
  'partly-paid',
  'denied',
  'returned-credentialing-hold',
  'credential-hold',
] as const;

export type ClaimsQueueItemStatus = (typeof ClaimsQueueItemStatuses)[number];

export interface ClaimsQueueItem {
  id: string;
  appointment: Appointment;
  location: Location;
  coverage: Coverage;
  assignee?: Practitioner;
  claim: Claim;
  eligibilityResponse?: CoverageEligibilityResponse;
  chargeItem?: ChargeItem;
  paymentData: any; // PaymentDataResponse; // https://github.com/masslight/ottehr/blob/main/packages/utils/lib/types/data/telemed/appointments/appointments.types.ts#L47
  status: ClaimsQueueItemStatus;
  patient: Patient;
  insurancePlan?: InsurancePlan;
}

export const ClaimQueueTypes = ['registration', 'coding', 'billing', 'credentialing-hold', 'credits'] as const;

export type ClaimsQueueType = (typeof ClaimQueueTypes)[number];

export type ClaimStatusHistoryExtensionEntry = {
  url: 'status-history-entry';
  extension: [{ url: 'status'; valueString: ClaimsQueueItemStatus }, { url: 'period'; valuePeriod: Period }];
};
export type ClaimStatusHistoryExtension = {
  url: string;
  extension: ClaimStatusHistoryExtensionEntry[];
};

export type ClaimQueueHistoryExtensionEntry = {
  url: 'queue-history-entry';
  extension: [{ url: 'queue'; valueString: ClaimsQueueType }, { url: 'period'; valuePeriod: Period }];
};
export type ClaimQueueHistoryExtension = {
  url: string;
  extension: ClaimQueueHistoryExtensionEntry[];
};

export type DateWithQualifier = {
  date?: string;
  qualifier?: string;
};

export type DatePeriod = {
  from?: string;
  to?: string;
};

export interface ServiceItem {
  // a
  datesOfService?: DatePeriod;
  // b
  placeOfService?: string;
  // c
  emergency?: boolean;
  // d
  procedures?: {
    cptOrHcpcs?: string;
    modifiers?: string[];
  };
  // e
  diagnosisPointer?: string;
  // f
  charges?: number;
  // g
  daysOrUnits?: number;
  // h
  epsdt?: string;
  familyPlan?: boolean;
  // j
  renderingProvider?: string;
  supplementalInformation?: string;
  encounter?: string;
}

/**
 * Based on https://www.cms.gov/Medicare/CMS-Forms/CMS-Forms/downloads/cms1500.pdf
 * and https://www.nucc.org/images/stories/PDF/1500_claim_form_instruction_manual_2022_07-v10a.pdf
 */
export interface Cms1500 {
  patient?: string;
  insurer?: string;
  primaryCoverage?: string;
  otherCoverage?: string;
  referringProvider?: string;
  billingProvider?: string;
  serviceFacilityLocation?: string;
  type: 'professional' | 'institutional'; // professional is CMS1500, institutional is CMS1450/UB-04
  encounter?: string;

  // 10
  patientConditionRelatedTo?: {
    employment?: boolean;
    autoAccident?: {
      autoAccidentState?: string;
    };
    otherAccident?: boolean;
  };

  // 10d
  claimCodes?: string[];

  // 11b
  otherClaimId?: string;

  // 12
  patientSignedDate?: string;

  // 14
  dateOfCurrentIllness?: DateWithQualifier;

  // 15
  otherDate?: DateWithQualifier;

  // 16
  patientUnableToWorkPeriod?: DatePeriod;

  // 17
  referringProviderQualifier?: string;

  // 18
  hospitalizationDates?: DatePeriod;

  // 19
  additionalClaimInformation?: string;

  // 20
  outsideLabCharges?: number;

  // 21
  diagnosis?: {
    icdIndicator?: string;
    codes?: { code?: string; display?: string }[];
  };

  // 22
  resubmission?: {
    code?: string;
    originalReferenceNumber?: string;
  };

  // 23
  priorAuthorizationNumber?: string;

  // 24
  services?: ServiceItem[];

  // 26
  patientAccountNumber?: string;

  // 28
  totalCharge?: number;

  // 29
  amountPaid?: number;

  // 31
  physicianSignedDate?: string;
}
