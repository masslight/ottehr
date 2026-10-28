import React, { useEffect, useMemo, useRef } from 'react';
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
  const { mutateAsync: markRead } = useMarkTaskNotesRead();
  const pendingReadIds = useRef(new Set<string>());
  const unreadNoteIds = useMemo(
    () =>
      isSuccess && isFetchedAfterMount
        ? data.pages.flatMap((page) =>
            page.notes.flatMap((note) => (note.isUnread && note.resourceId ? [note.resourceId] : []))
          )
        : [],
    [data, isSuccess, isFetchedAfterMount]
  );

  useEffect(() => {
    const noteIds = unreadNoteIds.filter((id) => !pendingReadIds.current.has(id));
    if (noteIds.length === 0) return;
    noteIds.forEach((id) => pendingReadIds.current.add(id));
    void markRead({ taskId, noteIds })
      .catch(() => undefined)
      .finally(() => noteIds.forEach((id) => pendingReadIds.current.delete(id)));
  }, [unreadNoteIds, markRead, taskId]);

  return <PatientNotesDialog target={{ taskId }} open onClose={onClose} onNoteCreated={onNoteCreated} />;
};
