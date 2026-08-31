import { Box, CircularProgress, TextField } from '@mui/material';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { holdPendingObservationFields } from 'src/features/visits/shared/stores/appointment/pending-observation-fields.store';
import { useExamObservations } from 'src/features/visits/telemed/hooks/useExamObservations';
import { useDebounce } from 'src/shared/hooks/useDebounce';

type ExamCommentFieldProps = {
  name: string;
  dataTestId?: string;
};

export const ExamCommentField = (props: ExamCommentFieldProps): ReactElement => {
  const { name, dataTestId } = props;

  const { value: field, update, delete: deleteField, isLoading } = useExamObservations(name);

  const { debounce } = useDebounce(700);
  const queuedWriteReleaseRef = useRef<() => void>();

  const onChange = (value: string): void => {
    value = value.trim();

    // The debounced write counts the field as busy from the keystroke on, not from the moment the
    // request leaves: a "Clear Exam" landing inside the debounce window would be undone by this
    // write, which would also be aimed at the Observation the clear has just deleted. The hold
    // replaces the one held for the keystroke this one supersedes.
    queuedWriteReleaseRef.current?.();
    queuedWriteReleaseRef.current = holdPendingObservationFields([name]);

    debounce(() => {
      // Released only after the write has taken its own hold, so the field never reads as free in
      // between.
      const release = queuedWriteReleaseRef.current;
      queuedWriteReleaseRef.current = undefined;

      if (value) {
        update({ ...field, field: name, note: value });
      } else {
        deleteField(field);
      }

      release?.();
    });
  };

  // The debounce timer outlives this component, so it is what normally releases the hold. Release it
  // on unmount too: nothing is left on screen for a "Clear" to race, and routing the release only
  // through the timer would leave the field busy for the rest of the session the day useDebounce
  // grows an unmount cleanup. The timer itself is deliberately left running — cancelling it would
  // drop a comment the provider typed just before navigating away.
  useEffect(() => () => queuedWriteReleaseRef.current?.(), []);

  const [value, setValue] = useState(field?.note || '');

  useEffect(() => {
    if (field?.note?.trim() !== value.trim()) {
      // update UI value only if it's different from the field value
      setValue(field?.note || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.note]);

  return (
    <TextField
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
      size="small"
      data-testid={dataTestId}
      fullWidth
      multiline
      InputProps={{
        endAdornment: isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size="20px" />
          </Box>
        ),
      }}
    />
  );
};
