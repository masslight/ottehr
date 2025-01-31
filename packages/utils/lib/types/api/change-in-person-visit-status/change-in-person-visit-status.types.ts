import { Secrets, User, VisitStatusWithoutUnknown } from 'utils';

export interface ChangeInPersonVisitStatusInput {
  encounterId: string;
  user: User;
  updatedStatus: VisitStatusWithoutUnknown;
  secrets: Secrets | null;
}

export interface ChangeInPersonVisitStatusResponse {
  message: string;
}
