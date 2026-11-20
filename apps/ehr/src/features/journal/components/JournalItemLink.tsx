import { Box, Link } from '@mui/material';
import { DateTime } from 'luxon';
import { MouseEvent, ReactElement } from 'react';
import { JournalItem } from 'utils/lib/types/api/provider-journal.types';
import { formatAge, JOURNAL_COLORS, journalItemLink } from '../helpers/journalHelpers';

interface Props {
  item: JournalItem;
  now: DateTime;
  /** Text-message items open the chat instead of a page. */
  onOpenChat: () => void;
  /** Side column: the action wraps and is bolder. */
  inPanel?: boolean;
}

/** "Review CBC, resulted 2d 5h ago" — the action is the link, opening in a new tab. */
export const JournalItemLink = ({ item, now, onOpenChat, inPanel }: Props): ReactElement => {
  const isChat = item.kind === 'text-message';
  const stop = (e: MouseEvent): void => e.stopPropagation();
  const linkSx = {
    color: 'primary.main',
    cursor: 'pointer',
    whiteSpace: inPanel ? 'normal' : 'nowrap',
    fontWeight: inPanel ? 500 : undefined,
    px: '2px',
    py: '1px',
    borderRadius: '3px',
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  };
  return (
    <Box component="span" sx={{ whiteSpace: inPanel ? 'normal' : 'nowrap' }}>
      {isChat ? (
        <Link
          component="button"
          type="button"
          sx={linkSx}
          onClick={(e: MouseEvent) => {
            stop(e);
            onOpenChat();
          }}
        >
          {item.label}
        </Link>
      ) : (
        <Link href={journalItemLink(item)} target="_blank" rel="noopener" sx={linkSx} onClick={stop}>
          {item.label}
        </Link>
      )}
      ,{' '}
      <Box
        component="span"
        sx={{ color: JOURNAL_COLORS.text2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      >
        {item.when} {formatAge(item.since, now)} ago
      </Box>
    </Box>
  );
};
