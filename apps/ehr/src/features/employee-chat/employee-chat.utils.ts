import { ChatListItem, ChatMessage, EmployeeChatState } from './employee-chat.store';

export function employeeInitials(firstName: string | undefined, lastName: string | undefined, name?: string): string {
  const first = firstName?.trim().charAt(0) ?? '';
  const last = lastName?.trim().charAt(0) ?? '';
  if (first && last) return `${first}${last}`.toUpperCase();
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return first.toUpperCase() || last.toUpperCase() || '?';
  const fromName =
    words.length === 1 ? words[0].charAt(0) : `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`;
  return fromName.toUpperCase();
}

export type TextSegment = { text: string; href?: string };

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

function trimUrl(candidate: string): string {
  let url = candidate.replace(TRAILING_PUNCTUATION, '');
  while (url.endsWith(')') && (url.match(/\(/g) ?? []).length < (url.match(/\)/g) ?? []).length) {
    url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, '');
  }
  return url;
}

export function splitLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = trimUrl(match[0]);
    if (url.length <= 'https://'.length) continue;
    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    segments.push({ text: url, href: url });
    cursor = start + url.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length > 0 ? segments : [{ text }];
}

export function upsertByIndex(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byIndex = new Map<number, ChatMessage>();
  existing.forEach((message) => byIndex.set(message.index, message));
  incoming.forEach((message) => byIndex.set(message.index, message));
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

export function lastSeenMessageIndex(
  viewportBottom: number,
  messages: { index: number; bottom: number }[]
): number | undefined {
  let seen: number | undefined;
  messages.forEach((message) => {
    if (message.bottom <= viewportBottom + 1 && (seen === undefined || message.index > seen)) seen = message.index;
  });
  return seen;
}

export function isUnread(chat: ChatListItem): boolean {
  if (chat.lastMessageIndex == null) return false;
  return chat.lastMessageIndex > (chat.lastReadIndex ?? -1);
}

export function selectHasUnread(state: EmployeeChatState): boolean {
  return Object.values(state.chats).some(isUnread);
}

export function visibleChats(chats: Record<string, ChatListItem>, activeSid: string | undefined): ChatListItem[] {
  return Object.values(chats)
    .filter((chat) => chat.lastMessageIndex != null || chat.sid === activeSid)
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
}
