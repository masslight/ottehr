import { User } from 'utils/lib/types/api/user.types';
import { PractitionerLicense } from './practitioner.types';

export interface GetUserResponse {
  message: string;
  user: User & {
    licenses: PractitionerLicense[];
  };
  userScheduleId: string | undefined;
  /** Whether this user participated in an encounter in the last 30 minutes — i.e. is actively working. */
  seenPatientRecently: boolean;
}

export interface GetUserParams {
  userId: string | undefined;
}
