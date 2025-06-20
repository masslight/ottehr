import { VisitStatusWithoutUnknown } from '../appointment.types';
import { User } from '../user.types';

export interface ChangeInPersonVisitStatusInput {
  encounterId: string;
  user: User;
  updatedStatus: VisitStatusWithoutUnknown;
}

export type ChangeInPersonVisitStatusResponse = Record<string, never>;
