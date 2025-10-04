import { useCallback, useEffect, useRef } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { DispositionDTO, DispositionType, getDefaultNote } from 'utils';
import { DispositionFormValues, mapFormToDisposition } from '../../telemed/utils/disposition.helper';

type SetNoteCache = (note: string) => void;
type WithNote = (values: DispositionFormValues) => DispositionDTO;

/**
 * This hook makes it possible to use DispositionDTO with a single note field as if we have unique note fields for each disposition type.
 * It creates a notes cache for each disposition type during the session and handles their usage.
 */
export const useDispositionMultipleNotes = ({
  methods,
  savedDisposition,
}: {
  methods: UseFormReturn<DispositionFormValues>;
  savedDisposition: DispositionDTO | undefined;
}): {
  setNoteCache: SetNoteCache;
  withNote: WithNote;
} => {
  const notesCacheRef = useRef<Partial<Record<DispositionType, string>>>({});
  const selectedDispositionType: DispositionType = useWatch({ control: methods.control, name: 'type' });

  const savedNoteForCurrentDispositionType =
    methods.getValues('type') === savedDisposition?.type ? savedDisposition?.note : '';

  useEffect(() => {
    notesCacheRef.current[selectedDispositionType] =
      notesCacheRef.current[selectedDispositionType] ||
      savedNoteForCurrentDispositionType ||
      getDefaultNote(selectedDispositionType);

    methods.resetField('note', {
      defaultValue: notesCacheRef.current[selectedDispositionType],
      keepTouched: true,
    });
  }, [methods, savedNoteForCurrentDispositionType, selectedDispositionType]);

  const setNoteCache: SetNoteCache = useCallback(
    (note: string) => {
      return (notesCacheRef.current[methods.getValues('type')] = note);
    },
    [methods]
  );

  const withNote: WithNote = useCallback((values) => {
    return mapFormToDisposition({
      ...values,
      note: notesCacheRef.current[values.type] ?? '',
    });
  }, []);

  return { setNoteCache, withNote };
};
