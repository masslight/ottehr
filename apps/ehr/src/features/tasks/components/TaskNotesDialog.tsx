import React, { useEffect } from 'react';
import { PatientNotesDialog } from 'src/features/patient-notes/components/PatientNotesDialog';
import { usePatientNotes } from 'src/features/patient-notes/hooks/usePatientNotes';
import { useMarkTaskNotesRead } from 'src/features/patient-notes/hooks/useTaskNotes';

interface TaskNotesDialogProps {
  taskId: string;
  onClose: () => void;
  onNoteCreated: (text: string) => void;
}

/** A task's notes. Once they've loaded, any the viewer hasn't read are marked read. */
export const TaskNotesDialog: React.FC<TaskNotesDialogProps> = ({ taskId, onClose, onNoteCreated }) => {
  const { data, isSuccess, isFetchedAfterMount } = usePatientNotes({ taskId });
  const { mutate: markRead } = useMarkTaskNotesRead();
  // What this opening loaded, not a list cached from an earlier one.
  const showsUnread =
    isSuccess && isFetchedAfterMount && !!data.pages.some((page) => page.notes.some((note) => note.isUnread));

  useEffect(() => {
    if (showsUnread) markRead(taskId);
  }, [showsUnread, markRead, taskId]);

  return <PatientNotesDialog target={{ taskId }} open onClose={onClose} onNoteCreated={onNoteCreated} />;
};
