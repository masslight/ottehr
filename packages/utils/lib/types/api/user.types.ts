import { User as OystehrUser } from '@oystehr/sdk';
import { Coding, Practitioner } from 'fhir/r4b';

export type User = OystehrUser & {
  profileResource?: Practitioner;
  faxNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  birthDate?: string;
};

export enum RoleType {
  NewUser = 'NewUser',
  Administrator = 'Administrator',
  AssistantAdmin = 'AssistantAdmin',
  RegionalTelemedLead = 'RegionalTelemedLead',
  CallCentre = 'CallCentre',
  Billing = 'Billing',
  Manager = 'Manager',
  Staff = 'Staff',
  Provider = 'Provider',
  FrontDesk = 'Front Desk',
  Inactive = 'Inactive',
  Prescriber = 'Prescriber',
  CustomerSupport = 'CustomerSupport',
  // Medical Assistant
}

export interface AccessPolicy {
  rule: {
    action: string | string[];
    resource: string | string[];
    effect: 'Allow' | 'Deny';
  }[];
}

export const UserRole = (code: string, display: string): Coding[] => [
  {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
    code,
    display,
  },
];

export const AVAILABLE_EMPLOYEE_ROLES: {
  value: RoleType;
  label: string;
  hint: string;
}[] = [
  {
    value: RoleType.Administrator,
    label: 'Administrator',
    hint: `Adjust full settings for entire system`,
  },
  {
    value: RoleType.Manager,
    label: 'Manager',
    hint: `Adjust operating hours or schedule overrides; adjust pre-booked visits per hour`,
  },
  {
    value: RoleType.Staff,
    label: 'Staff',
    hint: `No settings changes; essentially read-only`,
  },
  {
    value: RoleType.Provider,
    label: 'Provider',
    hint: `A clinician, such as a doctor, a PA or an NP`,
  },
  {
    value: RoleType.CustomerSupport,
    label: 'Customer Support',
    hint: `A customer support representative`,
  },
  // {
  //   value: RoleType.Prescriber,
  //   label: 'Prescriber',
  //   hint: `A clinician that is allowed to prescribe`,
  // },
];
