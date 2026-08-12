import { ConversationMessage } from './messaging.types';

export interface GetConversationInput {
  patientId: string;
  timezone: string;
}

export type GetConversationZambdaOutput = ConversationMessage[];
