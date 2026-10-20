import { useEffect, useRef } from 'react';

/**
 * Pushes the stored copy of a note field into its input, but never over text the provider typed and
 * hasn't saved yet.
 *
 * The note inputs are controlled and get re-set from the chart-fields cache every time that cache
 * changes: the debounced save writing its response back, another component's optimistic update (AI
 * suggestions append to HPI and mechanism of injury this way), or a plain refetch. Any of those
 * resolving while the provider is typing replaced the box with the older stored text and sent the
 * caret to the end, which reads as the field backspacing on its own mid-sentence.
 *
 * The box counts as in sync while it still holds the stored value we last applied; once the provider
 * types, it is out of sync and left alone until their own save round-trips — at which point the
 * stored value is their text again and external updates resume.
 */
export const useSyncServerNoteToField = ({
  serverValue,
  getFieldValue,
  setFieldValue,
  enabled = true,
}: {
  serverValue: string | undefined;
  getFieldValue: () => string;
  setFieldValue: (value: string) => void;
  enabled?: boolean;
}): void => {
  // the stored value the input was last known to agree with, seeded with whatever it mounted holding
  const syncedValueRef = useRef<string>();
  if (syncedValueRef.current === undefined) {
    syncedValueRef.current = getFieldValue();
  }

  // kept in refs so a new inline callback on every render doesn't re-run the effect
  const getFieldValueRef = useRef(getFieldValue);
  getFieldValueRef.current = getFieldValue;
  const setFieldValueRef = useRef(setFieldValue);
  setFieldValueRef.current = setFieldValue;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const storedValue = serverValue ?? '';
    const currentValue = getFieldValueRef.current();
    const hasUnsavedEdits = currentValue !== syncedValueRef.current;

    syncedValueRef.current = storedValue;

    if (hasUnsavedEdits || currentValue === storedValue) {
      return;
    }

    setFieldValueRef.current(storedValue);
  }, [serverValue, enabled]);
};
