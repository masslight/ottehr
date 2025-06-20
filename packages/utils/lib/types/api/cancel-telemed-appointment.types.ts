import { CancellationReasonOptionsProviderSideTelemed, CancellationReasonOptionsTelemed } from '../../telemed';

export interface CancelTelemedAppointmentZambdaInput {
  appointmentID: string;
  cancellationReason: CancellationReasonOptionsTelemed | CancellationReasonOptionsProviderSideTelemed;
  cancellationReasonAdditional?: string;
}

export type CancelTelemedAppointmentZambdaOutput = Record<string, never>;
