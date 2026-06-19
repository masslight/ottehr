import { useCallback, useEffect, useRef } from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { DispositionDTO, DispositionType, getDispositionDefaultTextFromProgressNoteConfig } from 'utils';
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
  const { data: progressNoteConfig, isPending: isProgressNoteConfigPending } = useProgressNoteConfig();

  const savedNoteForCurrentDispositionType =
    methods.getValues('type') === savedDisposition?.type ? savedDisposition?.note : '';

  useEffect(() => {
    const cachedNote = notesCacheRef.current[selectedDispositionType];
    if (cachedNote !== undefined) {
      methods.resetField('note', {
        defaultValue: cachedNote,
        keepTouched: true,
      });
      return;
    }

    // Wait for the query to settle, but don't gate on success — if the request errors,
    // `progressNoteConfig` is undefined and `getDispositionDefaultTextFromProgressNoteConfig`
    // falls back to the built-in defaults, preserving the pre-admin-config behavior.
    if (isProgressNoteConfigPending) {
      return;
    }

    const nextDefaultNote =
      savedNoteForCurrentDispositionType ||
      getDispositionDefaultTextFromProgressNoteConfig(progressNoteConfig, selectedDispositionType);

    notesCacheRef.current[selectedDispositionType] = nextDefaultNote;

    methods.resetField('note', {
      defaultValue: nextDefaultNote,
      keepTouched: true,
    });
  }, [
    isProgressNoteConfigPending,
    methods,
    progressNoteConfig,
    savedNoteForCurrentDispositionType,
    selectedDispositionType,
  ]);

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
