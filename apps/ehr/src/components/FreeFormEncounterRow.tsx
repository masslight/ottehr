import { InputBase, TableCell, TableRow } from '@mui/material';
import { isCancelledError, useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import React, { FC, useEffect, useRef, useState } from 'react';
import { SaveFreeFormEncounterInput } from 'utils/lib/types/api/free-form-encounter.types';
import { FreeFormEncounterHistoryRow } from 'utils/lib/types/api/patient-visit-history.types';
import { saveFreeFormEncounter } from '../api/api';
import { dataTestIds } from '../constants/data-test-ids';
import { formatISOStringToDateAndTime } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';

export interface FreeFormSaveSession {
  isCurrent: () => boolean;
  onSaved: (saved: FreeFormEncounterHistoryRow, created: boolean) => void;
}

type FreeFormEncounterRowProps = {
  patientId: string;
  dateTime: string | undefined;
  encounterId?: string;
  note: string;
  columnCount: number;
  isDraft?: boolean;
  startSave: () => FreeFormSaveSession;
  onDiscardDraft?: () => void;
  onEditingChange?: (editing: boolean) => void;
};

export const FreeFormEncounterRow: FC<FreeFormEncounterRowProps> = ({
  patientId,
  dateTime,
  encounterId,
  note,
  columnCount,
  isDraft = false,
  startSave,
  onDiscardDraft,
  onEditingChange,
}) => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);
  const savingRef = useRef(false);
  const cancelBlurSaveRef = useRef(false);
  const latestNoteRef = useRef(note);
  const [value, setValue] = useState(note);
  const [savedNote, setSavedNote] = useState(note);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    latestNoteRef.current = note;
    if (focusedRef.current) return;
    setSavedNote(note);
    setValue(note);
  }, [note]);

  const syncToLatestNote = (): void => {
    setSavedNote(latestNoteRef.current);
    setValue(latestNoteRef.current);
  };

  const saveMutation = useMutation({
    mutationFn: (input: SaveFreeFormEncounterInput) => {
      if (!oystehrZambda) throw new Error('Oystehr client is not initialized');
      return saveFreeFormEncounter(oystehrZambda, input);
    },
  });

  const hasUnsavedChanges = value.trim() !== savedNote.trim();
  const editing = focused || saveMutation.isPending || hasUnsavedChanges;

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  const discardUnsavedDraft = (): boolean => {
    if (!isDraft || encounterId) return false;
    onDiscardDraft?.();
    return true;
  };

  const handleFocus = (): void => {
    focusedRef.current = true;
    setFocused(true);
  };

  const handleBlur = async (): Promise<void> => {
    focusedRef.current = false;
    setFocused(false);
    const cancelled = cancelBlurSaveRef.current;
    cancelBlurSaveRef.current = false;
    if (savingRef.current) return;
    await saveOnBlur(cancelled);
  };

  const saveOnBlur = async (cancelled: boolean): Promise<void> => {
    const nextNote = value.trim();
    if (cancelled || !nextNote) {
      if (!discardUnsavedDraft()) syncToLatestNote();
      return;
    }
    if (nextNote === savedNote.trim()) {
      syncToLatestNote();
      return;
    }

    const session = startSave();
    savingRef.current = true;
    let saved: FreeFormEncounterHistoryRow;
    try {
      saved = await saveMutation.mutateAsync({ patientId, encounterId, note: nextNote });
    } catch {
      enqueueSnackbar(
        session.isCurrent()
          ? "Couldn't save the note. Please try again."
          : "Couldn't save the free-form note for the previous patient.",
        { variant: 'error' }
      );
      return;
    } finally {
      savingRef.current = false;
    }
    if (!session.isCurrent()) return;

    setSavedNote(saved.note);
    setValue(saved.note);
    session.onSaved(saved, !encounterId);

    if (encounterId) {
      try {
        await queryClient.invalidateQueries(
          { queryKey: ['get-patient-visit-history', { patientId }] },
          { throwOnError: true }
        );
      } catch (error) {
        if (!isCancelledError(error)) {
          enqueueSnackbar("Note saved, but the visit list couldn't refresh", { variant: 'warning' });
        }
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    cancelBlurSaveRef.current = true;
    inputRef.current?.blur();
  };

  return (
    <TableRow
      data-testid={dataTestIds.patientRecordPage.freeFormRow}
      sx={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
    >
      <TableCell sx={{ width: 150, paddingLeft: 2 }}>
        {dateTime ? formatISOStringToDateAndTime(dateTime) : '-'}
      </TableCell>
      <TableCell colSpan={columnCount - 1} sx={{ paddingLeft: 1 }}>
        <InputBase
          inputRef={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={handleFocus}
          onBlur={() => void handleBlur()}
          onKeyDown={handleKeyDown}
          placeholder="Enter free form note here..."
          autoFocus={isDraft}
          readOnly={saveMutation.isPending}
          multiline
          fullWidth
          inputProps={{ 'data-testid': dataTestIds.patientRecordPage.freeFormNoteInput }}
          sx={{ typography: 'body2' }}
        />
      </TableCell>
    </TableRow>
  );
};
