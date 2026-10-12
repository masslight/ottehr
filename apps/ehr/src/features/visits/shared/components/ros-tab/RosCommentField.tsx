import { Box, CircularProgress, TextField } from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getRosCommentFieldKey } from 'utils/lib/ottehr-config/review-of-systems';
import { useRosObservations } from '../../hooks/useRosObservations';
import { holdPendingObservationFields } from '../../stores/appointment/pending-observation-fields.store';
import { getRosStoreGeneration } from '../../stores/appointment/ros-observations.store';

const DEBOUNCE_MS = 700;

interface RosCommentFieldProps {
  systemKey: string;
  systemLabel: string;
}

type QueuedEdit = { note: string; generation: number; timer: ReturnType<typeof setTimeout>; release: () => void };

export const RosCommentField: FC<RosCommentFieldProps> = ({ systemKey, systemLabel }) => {
  const field = getRosCommentFieldKey(systemKey);
  const { observationMap, updateComment, isFieldPending } = useRosObservations();
  const savedNote = observationMap[field]?.note ?? '';

  const [value, setValue] = useState(savedNote);
  const queuedRef = useRef<QueuedEdit>();
  const flushRef = useRef<() => void>(() => {});

  flushRef.current = () => {
    const queued = queuedRef.current;
    if (!queued) return;
    queuedRef.current = undefined;
    clearTimeout(queued.timer);
    updateComment(field, `${systemLabel} comment`, queued.note, queued.generation);
    queued.release();
  };

  useEffect(() => () => flushRef.current(), []);

  useEffect(() => {
    if (!queuedRef.current && savedNote.trim() !== value.trim()) {
      setValue(savedNote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedNote]);

  const onChange = (newValue: string): void => {
    setValue(newValue);

    const previous = queuedRef.current;
    if (previous) clearTimeout(previous.timer);
    // Held from the keystroke so a "Clear ROS" can't land before the queued write.
    queuedRef.current = {
      note: newValue.trim(),
      generation: previous?.generation ?? getRosStoreGeneration(),
      timer: setTimeout(() => flushRef.current(), DEBOUNCE_MS),
      release: previous?.release ?? holdPendingObservationFields([field]),
    };
  };

  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => flushRef.current()}
      placeholder="Comment"
      size="small"
      fullWidth
      multiline
      data-testid={dataTestIds.reviewOfSystemsPage.rosCommentField(systemKey)}
      InputProps={{
        endAdornment: isFieldPending(field) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size="20px" />
          </Box>
        ),
      }}
    />
  );
};
