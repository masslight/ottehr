import { User } from 'utils/lib/types/api/user.types';
import { PractitionerLicense } from './practitioner.types';

export interface GetUserResponse {
  message: string;
  user: User & {
    licenses: PractitionerLicense[];
  };
  userScheduleId: string | undefined;
}

export interface GetUserParams {
  userId: string | undefined;
}
