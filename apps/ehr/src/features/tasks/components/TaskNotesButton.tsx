import { EditNote } from '@mui/icons-material';
import { Badge, useTheme } from '@mui/material';
import React from 'react';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { IconButtonContained } from 'src/features/visits/shared/components/IconButtonContained';
import { NoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { Task } from 'utils/lib/types/data/tasks/types';

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

  return (
    <Badge variant="dot" color="warning" overlap="circular" invisible={!hasUnread}>
      <GenericToolTip title="Internal Notes" placement="bottom">
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
