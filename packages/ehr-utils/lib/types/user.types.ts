import { User as ZapEHRUser } from '@zapehr/sdk';
import { Practitioner } from 'fhir/r4';

export type User = ZapEHRUser & {
  phoneNumber: string; // as of current version of zap sdk phoneNumber is absent but back-end returns it.
  roles: { name: string }[];
  profileResource?: Practitioner;
};
