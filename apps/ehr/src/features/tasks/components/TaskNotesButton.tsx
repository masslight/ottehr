import { EditNote } from '@mui/icons-material';
import { Badge, useTheme } from '@mui/material';
import React from 'react';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { IconButtonContained } from 'src/features/visits/shared/components/IconButtonContained';
import { NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { Task } from 'utils/lib/types/data/tasks/types';
import { TaskNotesPreview } from './TaskTitle';

interface TaskNotesButtonProps {
  task: Task;
  notes: NoteDTO[];
  currentUserId: string | undefined;
  onOpenNotes: () => void;
}

export const TaskNotesButton: React.FC<TaskNotesButtonProps> = ({ task, notes, currentUserId, onOpenNotes }) => {
  const theme = useTheme();
  const involved =
    !!currentUserId &&
    (task.assignee?.id === currentUserId ||
      task.createdById === currentUserId ||
      notes.some((note) => note.authorId === currentUserId));
  const hasUnread = involved && notes.some((note) => note.isUnread);

  // One marker: the note count, orange while any are unread for me, grey once read; white text for contrast.
  return (
    <Badge
      badgeContent={notes.length}
      overlap="circular"
      sx={{
        '& .MuiBadge-badge': {
          height: '18px',
          minWidth: '18px',
          padding: '0 4px',
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: hasUnread ? theme.palette.warning.dark : theme.palette.grey[700],
          color: theme.palette.common.white,
        },
      }}
    >
      <GenericToolTip
        title={notes.length ? <TaskNotesPreview notes={notes} /> : 'Internal Notes'}
        customWidth={notes.length ? 400 : undefined}
        placement="bottom"
        describeChild
      >
        <IconButtonContained
          variant="primary"
          aria-label={hasUnread ? 'Internal Notes, unread' : 'Internal Notes'}
          onClick={onOpenNotes}
        >
          <EditNote sx={{ color: theme.palette.primary.contrastText }} />
        </IconButtonContained>
      </GenericToolTip>
    </Badge>
  );
};
