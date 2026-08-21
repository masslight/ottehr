import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  activeMentions,
  filterMentionCandidates,
  findMentionQuery,
  insertMention,
  isMentioned,
  splitBodyByMentions,
} from '../../src/features/team-chat/mention.utils';
import { MessageBubble } from '../../src/features/team-chat/MessageBubble';
import { TeamChatMention, TeamChatMessage } from '../../src/features/team-chat/team-chat.store';

const ANA: TeamChatMention = { profile: 'Practitioner/ana', name: 'Ana Lopez' };
const ANA_MARIA: TeamChatMention = { profile: 'Practitioner/ana-maria', name: 'Ana Maria Lopez' };
const BOB: TeamChatMention = { profile: 'Practitioner/bob', name: 'Bob Chen' };

describe('findMentionQuery', () => {
  it('finds a mention at the start of the text', () => {
    expect(findMentionQuery('@An', 3)).toEqual({ start: 0, query: 'An' });
  });

  it('finds a mention mid-text after whitespace', () => {
    expect(findMentionQuery('hello @Bob', 10)).toEqual({ start: 6, query: 'Bob' });
  });

  it('allows a two-word partial name', () => {
    expect(findMentionQuery('ping @Ana Lo', 12)).toEqual({ start: 5, query: 'Ana Lo' });
  });

  it('ignores an @ embedded in a word (emails)', () => {
    expect(findMentionQuery('mail me a@b.com', 15)).toBeUndefined();
  });

  it('gives up after more than two words', () => {
    expect(findMentionQuery('@one two three', 14)).toBeUndefined();
  });

  it('gives up across newlines', () => {
    expect(findMentionQuery('@Ana\nhello', 10)).toBeUndefined();
  });

  it('only looks before the caret', () => {
    expect(findMentionQuery('@Ana hello', 4)).toEqual({ start: 0, query: 'Ana' });
  });
});

describe('filterMentionCandidates', () => {
  const all = [ANA, ANA_MARIA, BOB];

  it('returns everyone for an empty query', () => {
    expect(filterMentionCandidates(all, '')).toEqual(all);
  });

  it('matches on full-name prefix case-insensitively', () => {
    expect(filterMentionCandidates(all, 'ana m')).toEqual([ANA_MARIA]);
  });

  it('matches on any word of the name', () => {
    expect(filterMentionCandidates(all, 'lopez')).toEqual([ANA, ANA_MARIA]);
    expect(filterMentionCandidates(all, 'chen')).toEqual([BOB]);
  });
});

describe('insertMention', () => {
  it('replaces the typed fragment with the full mention and a trailing space', () => {
    const result = insertMention('hey @Bo, look', { start: 4, query: 'Bo' }, BOB);
    expect(result.text).toBe('hey @Bob Chen , look');
    expect(result.caret).toBe('hey @Bob Chen '.length);
  });
});

describe('activeMentions', () => {
  it('keeps mentions still present in the text and drops deleted ones', () => {
    expect(activeMentions('hi @Bob Chen', [BOB, ANA])).toEqual([BOB]);
  });

  it('dedupes repeated selections of the same person', () => {
    expect(activeMentions('@Bob Chen and @Bob Chen', [BOB, BOB])).toEqual([BOB]);
  });
});

describe('splitBodyByMentions', () => {
  it('returns a single plain segment when there are no mentions', () => {
    expect(splitBodyByMentions('plain text', [])).toEqual([{ text: 'plain text', mention: undefined }]);
  });

  it('splits around a mention', () => {
    expect(splitBodyByMentions('hi @Bob Chen bye', [BOB])).toEqual([
      { text: 'hi ', mention: undefined },
      { text: '@Bob Chen', mention: BOB },
      { text: ' bye', mention: undefined },
    ]);
  });

  it('prefers the longer name when one mention is a prefix of another', () => {
    const segments = splitBodyByMentions('@Ana Maria Lopez hello', [ANA, ANA_MARIA]);
    expect(segments[0]).toEqual({ text: '@Ana Maria Lopez', mention: ANA_MARIA });
  });
});

describe('isMentioned', () => {
  it('is true only when my profile is in the mention list', () => {
    expect(isMentioned([BOB, ANA], ANA.profile)).toBe(true);
    expect(isMentioned([BOB], ANA.profile)).toBe(false);
    expect(isMentioned(undefined, ANA.profile)).toBe(false);
    expect(isMentioned([BOB], undefined)).toBe(false);
  });
});

describe('MessageBubble', () => {
  const message: TeamChatMessage = {
    sid: 'IM123',
    index: 0,
    author: 'user-bob',
    body: 'hey @Ana Lopez can you review?',
    dateCreated: '2026-08-21T14:30:00.000Z',
    attributes: { senderName: 'Bob Chen', senderProfile: BOB.profile, mentions: [ANA] },
  };

  it('shows the sender display name from attributes', () => {
    render(<MessageBubble message={message} isMine={false} myProfile={ANA.profile} />);
    expect(screen.getByText(/Bob Chen/)).toBeDefined();
  });

  it('renders the mention as a highlighted segment', () => {
    render(<MessageBubble message={message} isMine={false} myProfile={ANA.profile} />);
    expect(screen.getByText('@Ana Lopez')).toBeDefined();
  });

  it("labels the current user's own messages as You", () => {
    render(<MessageBubble message={message} isMine={true} myProfile={BOB.profile} />);
    expect(screen.getByText(/You/)).toBeDefined();
  });

  it('falls back to the raw author identity when attributes carry no name', () => {
    const bare: TeamChatMessage = { ...message, attributes: {} };
    render(<MessageBubble message={bare} isMine={false} myProfile={undefined} />);
    expect(screen.getByText(/user-bob/)).toBeDefined();
  });
});
