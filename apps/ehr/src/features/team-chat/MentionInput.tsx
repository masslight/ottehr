import SendIcon from '@mui/icons-material/Send';
import { Box, IconButton, List, ListItemButton, ListItemText, Paper, Popper, TextField } from '@mui/material';
import { FC, KeyboardEvent, useMemo, useRef, useState } from 'react';
import {
  activeMentions,
  filterMentionCandidates,
  findMentionQuery,
  insertMention,
  MentionQuery,
} from './mention.utils';
import { TeamChatMention } from './team-chat.store';

const MAX_SUGGESTIONS = 6;

interface MentionInputProps {
  candidates: TeamChatMention[];
  disabled: boolean;
  onSend: (body: string, mentions: TeamChatMention[]) => void;
}

export const MentionInput: FC<MentionInputProps> = ({ candidates, disabled, onSend }) => {
  const [text, setText] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<TeamChatMention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | undefined>(undefined);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(() => {
    if (!mentionQuery) return [];
    return filterMentionCandidates(candidates, mentionQuery.query).slice(0, MAX_SUGGESTIONS);
  }, [candidates, mentionQuery]);
  const popperOpen = mentionQuery !== undefined && suggestions.length > 0;

  const syncMentionQuery = (value: string, caret: number): void => {
    setMentionQuery(findMentionQuery(value, caret));
    setHighlightIndex(0);
  };

  const pickMention = (mention: TeamChatMention): void => {
    if (!mentionQuery) return;
    const result = insertMention(text, mentionQuery, mention);
    setText(result.text);
    setSelectedMentions((prev) => [...prev, mention]);
    setMentionQuery(undefined);
    // Restore focus and caret after the list item click steals focus.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(result.caret, result.caret);
    });
  };

  const send = (): void => {
    const body = text.trim();
    if (body === '' || disabled) return;
    onSend(body, activeMentions(body, selectedMentions));
    setText('');
    setSelectedMentions([]);
    setMentionQuery(undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (popperOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightIndex((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pickMention(suggestions[highlightIndex]);
        return;
      }
      if (event.key === 'Escape') {
        setMentionQuery(undefined);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <Box ref={anchorRef} sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
      <TextField
        fullWidth
        multiline
        maxRows={4}
        size="small"
        placeholder="Message the team — use @ to mention someone"
        value={text}
        inputRef={inputRef}
        onChange={(event) => {
          const target = event.target as HTMLTextAreaElement;
          setText(target.value);
          syncMentionQuery(target.value, target.selectionStart ?? target.value.length);
        }}
        onKeyDown={handleKeyDown}
        inputProps={{ 'data-testid': 'team-chat-input' }}
      />
      <Popper open={popperOpen} anchorEl={anchorRef.current} placement="top-start" sx={{ zIndex: 1400 }}>
        <Paper elevation={4} sx={{ minWidth: 220, maxHeight: 240, overflowY: 'auto' }}>
          <List dense data-testid="team-chat-mention-list">
            {suggestions.map((suggestion, index) => (
              <ListItemButton
                key={suggestion.profile}
                selected={index === highlightIndex}
                // onMouseDown so the pick happens before the TextField loses focus
                onMouseDown={(event) => {
                  event.preventDefault();
                  pickMention(suggestion);
                }}
              >
                <ListItemText primary={suggestion.name} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Popper>
      <IconButton color="primary" aria-label="Send message" disabled={disabled || text.trim() === ''} onClick={send}>
        <SendIcon />
      </IconButton>
    </Box>
  );
};
