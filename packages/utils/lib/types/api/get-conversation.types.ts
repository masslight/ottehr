import { ConversationMessage } from '.';

export interface GetConversationInput {
  patientId: string;
  timezone: string;
}

export type GetConversationZambdaOutput = ConversationMessage[];
