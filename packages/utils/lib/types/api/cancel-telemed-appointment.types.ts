import { VALUE_SETS } from '../../ottehr-config/value-sets';

export interface CancelTelemedAppointmentZambdaInput {
  appointmentID: string;
  cancellationReason:
    | (typeof VALUE_SETS)['cancelReasonOptionsVirtualPatient'][number]['value']
    | (typeof VALUE_SETS)['cancelReasonOptionsVirtualProvider'][number]['value'];
  cancellationReasonAdditional?: string;
}

export type CancelTelemedAppointmentZambdaOutput = Record<string, never>;
