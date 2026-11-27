import { SupportChatMessageKind } from '../types/api/support-chat.types';

const PROMPT_KINDS: SupportChatMessageKind[] = ['greeting', 'patient-prompt', 'visit-prompt'];
const ANSWER_KINDS: SupportChatMessageKind[] = ['recap', 'confirmation'];

export function findActivePromptIndex(kinds: SupportChatMessageKind[]): number {
  for (let index = kinds.length - 1; index >= 0; index--) {
    if (ANSWER_KINDS.includes(kinds[index])) return -1;
    if (PROMPT_KINDS.includes(kinds[index])) return index;
  }

  return -1;
}
