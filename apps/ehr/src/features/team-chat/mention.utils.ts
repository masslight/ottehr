import { TeamChatMention } from './team-chat.store';

export interface MentionQuery {
  // Index of the '@' character in the text
  start: number;
  // The partial name typed after '@' (may contain a single space for first/last)
  query: string;
}

// Finds an in-progress @-mention immediately before the caret: an '@' at the start
// of the text or preceded by whitespace, followed by up to two words the caret is
// still inside. Returns undefined when the caret isn't in a mention context.
export function findMentionQuery(text: string, caret: number): MentionQuery | undefined {
  const beforeCaret = text.slice(0, caret);
  const atIndex = beforeCaret.lastIndexOf('@');
  if (atIndex === -1) return undefined;
  if (atIndex > 0 && !/\s/.test(beforeCaret[atIndex - 1])) return undefined;
  const query = beforeCaret.slice(atIndex + 1);
  // Give up once the fragment can no longer be a name prefix: >2 words or a
  // second '@' means the author has moved on from mentioning.
  if (query.includes('@') || query.includes('\n')) return undefined;
  if (query.split(' ').length > 2) return undefined;
  return { start: atIndex, query };
}

export function filterMentionCandidates(candidates: TeamChatMention[], query: string): TeamChatMention[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return candidates;
  return candidates.filter((candidate) => {
    const name = candidate.name.toLowerCase();
    return name.startsWith(normalized) || name.split(' ').some((word) => word.startsWith(normalized));
  });
}

// Inserts the selected mention over the in-progress '@query' fragment, returning
// the new text and the caret position just after the inserted mention.
export function insertMention(
  text: string,
  mentionQuery: MentionQuery,
  mention: TeamChatMention
): { text: string; caret: number } {
  const before = text.slice(0, mentionQuery.start);
  const after = text.slice(mentionQuery.start + 1 + mentionQuery.query.length);
  const inserted = `@${mention.name} `;
  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}

// A selected mention only counts if its '@Name' text is still present when the
// message is sent — the author may have deleted or edited it away.
export function activeMentions(text: string, selected: TeamChatMention[]): TeamChatMention[] {
  const seen = new Set<string>();
  return selected.filter((mention) => {
    if (seen.has(mention.profile)) return false;
    if (!text.includes(`@${mention.name}`)) return false;
    seen.add(mention.profile);
    return true;
  });
}

export type BodySegment = { text: string; mention: TeamChatMention | undefined };

// Splits a message body into plain-text and mention segments for rendering.
// Longer names are matched first so '@Ana Maria Lopez' wins over '@Ana Maria'.
export function splitBodyByMentions(body: string, mentions: TeamChatMention[]): BodySegment[] {
  if (mentions.length === 0 || body === '') return [{ text: body, mention: undefined }];
  const byLength = [...mentions].sort((a, b) => b.name.length - a.name.length);
  const segments: BodySegment[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const next = byLength
      .map((mention) => ({ mention, index: body.indexOf(`@${mention.name}`, cursor) }))
      .filter((found) => found.index !== -1)
      .sort((a, b) => a.index - b.index || b.mention.name.length - a.mention.name.length)[0];
    if (!next) {
      segments.push({ text: body.slice(cursor), mention: undefined });
      break;
    }
    if (next.index > cursor) {
      segments.push({ text: body.slice(cursor, next.index), mention: undefined });
    }
    segments.push({ text: `@${next.mention.name}`, mention: next.mention });
    cursor = next.index + next.mention.name.length + 1;
  }
  return segments;
}

export function isMentioned(mentions: TeamChatMention[] | undefined, myProfile: string | undefined): boolean {
  if (!mentions || !myProfile) return false;
  return mentions.some((mention) => mention.profile === myProfile);
}
