import { VALUE_SETS } from '../../ottehr-config/value-sets';

export interface CancelTelemedAppointmentZambdaInput {
  appointmentID: string;
  cancellationReason:
    | (typeof VALUE_SETS)['cancelReasonOptionsVirtual'][number]
    | (typeof VALUE_SETS)['cancelReasonOptionsVirtualProviderSide'][number];
  cancellationReasonAdditional?: string;
}

export type CancelTelemedAppointmentZambdaOutput = Record<string, never>;
