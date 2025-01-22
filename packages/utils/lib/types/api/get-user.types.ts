import { User } from '@oystehr/sdk';
import { PractitionerLicense } from './practitioner.types';

export interface GetUserResponse {
  message: string;
  user: User & {
    licenses: PractitionerLicense[];
  };
}

export interface GetUserParams {
  userId: string | undefined;
}
