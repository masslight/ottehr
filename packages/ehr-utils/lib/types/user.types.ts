import { User as ZapEHRUser } from '@zapehr/sdk';
import { Practitioner } from 'fhir/r4';

export type User = ZapEHRUser & {
  phoneNumber: string; // as of current version of zap sdk phoneNumber is absent but back-end returns it.
  roles: { name: string }[];
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
}
