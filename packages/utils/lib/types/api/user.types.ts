import { User as OystehrUser } from '@oystehr/sdk';
import { Coding, Practitioner } from 'fhir/r4b';
import { PARTICIPATION_CODE_SYSTEM } from '../../fhir/constants';

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

/**
 * Whether an Oystehr user's profile points at a Practitioner.
 *
 * Self-registered users land on a Patient profile instead, which is what "needs review" means in the
 * employee list: they hold no role and have no clinician record yet. `update-user` creates the
 * Practitioner and repoints the profile the first time such a user is saved.
 */
export const hasPractitionerProfile = (profile: string | undefined): boolean =>
  profile?.startsWith('Practitioner/') ?? false;

/**
 * Whether a role name is one of the roles an employee can hold.
 *
 * A project can carry roles that aren't employee roles at all — a self-registered user holds
 * `Patient` — and those must not be echoed back when saving an employee record, both because
 * `update-user` rejects them and because converting such a user to staff is precisely the point at
 * which the old role should fall away.
 *
 * Note this is deliberately the whole {@link RoleType} enum rather than `AVAILABLE_EMPLOYEE_ROLES`:
 * roles that exist but aren't offered as checkboxes are still real, and filtering to the displayed
 * set would silently strip them from anyone who holds one.
 */
export const isRoleType = (roleName: string): roleName is RoleType =>
  (Object.values(RoleType) as string[]).includes(roleName);

export enum RoleType {
  Administrator = 'Administrator',
  AssistantAdmin = 'AssistantAdmin',
  BillingAdmin = 'BillingAdmin',
  Billing = 'Billing',
  CallCentre = 'CallCentre',
  // Clinical staff without an NPI (e.g. nurses, medical assistants). Provider-level EHR access
  // except NPI-gated actions (sign notes, e-prescribe, external labs & imaging, claims, in-house meds).
  Clinician = 'Clinician',
  CustomerSupport = 'Customer Support',
  FrontDesk = 'Front Desk',
  Inactive = 'Inactive',
  Manager = 'Manager',
  // Medical Assistant
  NewUser = 'NewUser',
  Provider = 'Provider',
  RegionalTelemedLead = 'RegionalTelemedLead',
  Staff = 'Staff',
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
    system: PARTICIPATION_CODE_SYSTEM,
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
    value: RoleType.BillingAdmin,
    label: 'Billing Admin',
    hint: `Administrator access in the Billing App. No access to the EHR.`,
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
    value: RoleType.Clinician,
    label: 'Clinician',
    hint: `Clinical staff without an NPI, such as a nurse or medical assistant. Provider access except NPI-gated actions.`,
  },
  {
    value: RoleType.CustomerSupport,
    label: 'Customer Support',
    hint: `A customer support representative`,
  },
];
