import { Secrets } from '../../../secrets';
import { VisitStatusWithoutUnknown } from '../appointment.types';
import { User } from '../user.types';

export interface ChangeInPersonVisitStatusInput {
  encounterId: string;
  user: User;
  updatedStatus: VisitStatusWithoutUnknown;
  secrets: Secrets | null;
}

export interface ChangeInPersonVisitStatusResponse {
  message: string;
}
