import { z } from 'zod';
import { ottehrCodeSystemUrl, ottehrExtensionUrl } from '../../fhir/systemUrls';

export enum SupportChatTopic {
  prescriptionRefill = 'prescription-refill',
  schoolWorkNote = 'school-work-note',
  medicalRecord = 'medical-record',
}

export const SUPPORT_CHAT_TOPIC_LABEL: Record<SupportChatTopic, string> = {
  [SupportChatTopic.prescriptionRefill]: 'Prescription Refill',
  [SupportChatTopic.schoolWorkNote]: 'School/Work Note',
  [SupportChatTopic.medicalRecord]: 'Medical Record',
};

export type SupportChatMessageKind = 'greeting' | 'visit-prompt' | 'recap' | 'confirmation' | 'text';
export type SupportChatAuthor = 'patient' | 'staff' | 'bot';

export interface SupportChatOption {
  id: string;
  label: string;
}

export interface SupportChatMessageDto {
  id: string;
  author: SupportChatAuthor;
  authorName: string;
  kind: SupportChatMessageKind;
  text: string;
  sentAt: string;
  isRead: boolean;
  options?: SupportChatOption[];
  requestTitle?: string;
}

export interface GetSupportChatResponse {
  isAvailable: boolean;
  messages: SupportChatMessageDto[];
  unreadCount: number;
}

export const MarkSupportChatReadInputSchema = z.object({
  taskId: z.string().uuid().optional(),
});

export type MarkSupportChatReadInput = z.infer<typeof MarkSupportChatReadInputSchema>;

export const GetSupportChatInputSchema = MarkSupportChatReadInputSchema.extend({
  unreadOnly: z.boolean().optional(),
});

export type GetSupportChatInput = z.infer<typeof GetSupportChatInputSchema>;

const MessageTextSchema = z.string().trim().min(1).max(4000);

export const SendSupportChatMessageInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('new-request') }),
  z.object({ action: z.literal('select-topic'), topic: z.nativeEnum(SupportChatTopic) }),
  z.object({ action: z.literal('select-visit'), appointmentId: z.string().uuid() }),
  z.object({ action: z.literal('text'), text: MessageTextSchema }),
]);

export type SendSupportChatMessageInput = z.infer<typeof SendSupportChatMessageInputSchema>;

export const ReplySupportChatInputSchema = z.object({
  taskId: z.string().uuid(),
  text: MessageTextSchema,
});

export type ReplySupportChatInput = z.infer<typeof ReplySupportChatInputSchema>;

export const SUPPORT_CHAT_THREAD_SYSTEM = ottehrCodeSystemUrl('support-chat-thread');
export const SUPPORT_CHAT_UNREAD_TAG = { system: ottehrCodeSystemUrl('support-chat-unread'), code: 'unread' };
export const SUPPORT_CHAT_CATEGORY = { system: ottehrCodeSystemUrl('communication-category'), code: 'support-chat' };
export const SUPPORT_CHAT_MESSAGE_KIND_EXTENSION_URL = ottehrExtensionUrl('support-chat-message-kind');
export const SUPPORT_CHAT_TOPIC_EXTENSION_URL = ottehrExtensionUrl('support-chat-topic');
export const SUPPORT_CHAT_OPTION_EXTENSION_URL = ottehrExtensionUrl('support-chat-option');

export const SUPPORT_CHAT_BOT_NAME = 'Support Automated Message';
export const SUPPORT_CHAT_STAFF_NAME = 'Support Team';
