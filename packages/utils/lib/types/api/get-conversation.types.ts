import { ConversationMessage } from '.';

export interface GetConversationInput {
  smsNumbers: string[];
  timezone: string;
}

export type GetConversationZambdaOutput = ConversationMessage[];
