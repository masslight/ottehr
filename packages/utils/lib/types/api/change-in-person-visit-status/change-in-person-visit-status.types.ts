import { VisitStatusWithoutUnknown } from '../appointment.types';

export interface ChangeInPersonVisitStatusInput {
  encounterId: string;
  updatedStatus: VisitStatusWithoutUnknown;
}

export type ChangeInPersonVisitStatusResponse = Record<string, never>;
