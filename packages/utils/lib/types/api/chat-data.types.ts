import { z } from 'zod';
import { SMSRecipient } from './messaging.types';

/**
 * Input of the EHR's get-chat-data zambda: what the SMS chat needs for a patient who is not tied to one
 * open visit (the patient record). `encounterId` names the visit whose office details fill the quick texts.
 */
export const GetChatDataInputSchema = z.object({
  patientId: z.string().trim().uuid(),
  encounterId: z.string().trim().uuid().optional(),
});

export type GetChatDataInput = z.output<typeof GetChatDataInputSchema>;

export interface ChatVisitData {
  // ISO start of the visit's appointment
  appointmentStart?: string;
  locationName?: string;
  locationReviewLink?: string;
  officePhone?: string;
  supportPhone?: string;
}

export interface GetChatDataResponse {
  // every number a message to this patient goes to, built the way the tracking board builds its recipients
  recipients: SMSRecipient[];
  // absent when no encounter was named, or it is not one of this patient's
  visit?: ChatVisitData;
}
