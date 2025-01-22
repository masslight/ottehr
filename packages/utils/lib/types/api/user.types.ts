import { User as OystehrUser } from '@oystehr/sdk';
import { Coding, Practitioner } from 'fhir/r4b';

export type User = OystehrUser & {
  profileResource?: Practitioner;
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
  // Medical Assystant
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
