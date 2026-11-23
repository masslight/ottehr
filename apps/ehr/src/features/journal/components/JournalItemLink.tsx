import { WarningAmberOutlined } from '@mui/icons-material';
import { Box, Link } from '@mui/material';
import { DateTime } from 'luxon';
import { KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { JournalItem } from 'utils/lib/types/api/provider-journal.types';
import { TaskAlertDisplay } from 'utils/lib/types/data/tasks/types';
import { formatAge, JOURNAL_COLORS, journalItemLink, opensTaskNotes } from '../helpers/journalHelpers';

interface Props {
  item: JournalItem;
  now: DateTime;
  /** Text-message items and unread Support Chat requests open the chat, and general tasks their Task notes, instead of a page. */
  onOpenChat: (item: JournalItem) => void;
  /** Side column: the action wraps and is bolder. */
  inPanel?: boolean;
}

/** "Review CBC, resulted 2d 5h ago" — the action is the link, opening in a new tab. */
export const JournalItemLink = ({ item, now, onOpenChat, inPanel }: Props): ReactElement => {
  const isChat =
    item.kind === 'text-message' || (item.kind === 'patient-request' && !!item.unread) || opensTaskNotes(item);
  const stop = (e: MouseEvent): void => e.stopPropagation();
  const linkSx = {
    color: 'primary.main',
    cursor: 'pointer',
    fontWeight: inPanel ? 500 : undefined,
    px: '2px',
    py: '1px',
    borderRadius: '3px',
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  };
  return (
    // The name wraps so a long lab name stays in its column instead of running under the row's icons.
    <Box component="span">
      {isChat ? (
        // An inline span, not a <button>, so a long name wraps with the text after it in the side column.
        <Link
          component="span"
          role="button"
          tabIndex={0}
          sx={linkSx}
          onClick={(e: MouseEvent) => {
            stop(e);
            onOpenChat(item);
          }}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            onOpenChat(item);
          }}
        >
          {item.label}
        </Link>
      ) : (
        <Link href={journalItemLink(item)} target="_blank" rel="noopener" sx={linkSx} onClick={stop}>
          {item.label}
        </Link>
      )}
      {item.alert && (
        // Same icon and hover as the Tasks page's alert.
        <GenericToolTip title={TaskAlertDisplay[item.alert] ?? item.alert} placement="top">
          <WarningAmberOutlined fontSize="small" color="warning" sx={{ ml: '5px', verticalAlign: 'middle' }} />
        </GenericToolTip>
      )}
      ,{' '}
      <Box
        component="span"
        sx={{ color: JOURNAL_COLORS.text2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      >
        {item.assignedTo ? `assigned to ${item.assignedTo}` : item.when} {formatAge(item.since, now)} ago
      </Box>
    </Box>
  );
};
