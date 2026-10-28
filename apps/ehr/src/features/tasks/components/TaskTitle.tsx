import { Box, Link, Typography } from '@mui/material';
import React from 'react';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { formatNoteByline } from 'src/features/patient-notes/components/PatientNoteItem';
import { PatientNoteDTO } from 'utils/lib/types/api/patient-notes/patient-notes.types';
import { Task } from 'utils/lib/types/data/tasks/types';

interface TaskTitleProps {
  task: Task;
  notes: PatientNoteDTO[];
  onOpenNotes: () => void;
}

export const TaskTitle: React.FC<TaskTitleProps> = ({ task, notes, onOpenNotes }) => {
  const preview = notes.length ? (
    <Box sx={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {notes.map((note) => (
        <Box key={note.resourceId}>
          <Typography variant="body2" whiteSpace="pre-wrap">
            {note.text}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {formatNoteByline(note)}
          </Typography>
        </Box>
      ))}
    </Box>
  ) : (
    ''
  );
  return (
    <GenericToolTip title={preview} customWidth={400} placement="bottom-start" describeChild>
      <Link
        component="button"
        underline="none"
        onClick={onOpenNotes}
        sx={{
          color: '#000000DE',
          fontWeight: 500,
          fontSize: '1rem',
          textAlign: 'left',
          textDecoration: task.status === 'completed' ? 'line-through' : undefined,
        }}
      >
        {task.title}
      </Link>
    </GenericToolTip>
  );
};
