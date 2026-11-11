import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { isValidTimeOfDay, slotsThatFit, timeToMinutes } from 'utils/lib/provider-schedule/expand';
import { BlockKind, IsoWeekday, UNAVAILABLE_REASONS, UnavailableReason } from 'utils/lib/provider-schedule/types';
import { EffectiveVisitType } from '../ProviderCalendar';

export const WEEKDAY_SHORT: Record<IsoWeekday, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};
const ALL_DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export const REASON_LABEL: Record<UnavailableReason, string> = {
  lunch: 'Lunch',
  admin: 'Admin time',
  meeting: 'Meeting',
  huddle: 'Huddle',
  other: 'Other',
};

export interface BlockDraft {
  /** Present when editing an existing block. */
  id?: string;
  weekdays: IsoWeekday[];
  startTime: string;
  endTime: string;
  kind: BlockKind;
  label: string;
  visitTypeIds: string[];
  reason?: UnavailableReason;
}

interface BlockDialogProps {
  open: boolean;
  initial: BlockDraft | undefined;
  providerVisitTypes: EffectiveVisitType[];
  onClose: () => void;
  onSave: (draft: BlockDraft) => void;
  onDelete?: (id: string) => void;
}

/** Create or edit a template block. New blocks can be stamped onto several weekdays at once. */
export const BlockDialog: FC<BlockDialogProps> = ({ open, initial, providerVisitTypes, onClose, onSave, onDelete }) => {
  const [draft, setDraft] = useState<BlockDraft | undefined>(initial);
  useEffect(() => setDraft(initial), [initial]);
  if (!draft) return null;

  const editing = Boolean(draft.id);
  const timesValid =
    isValidTimeOfDay(draft.startTime) &&
    isValidTimeOfDay(draft.endTime) &&
    timeToMinutes(draft.endTime) > timeToMinutes(draft.startTime);
  const minutes = timesValid ? timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime) : 0;
  const allowed = draft.visitTypeIds.length
    ? providerVisitTypes.filter((v) => draft.visitTypeIds.includes(v.id))
    : providerVisitTypes;
  const canSave = timesValid && draft.label.trim() !== '' && draft.weekdays.length > 0;

  const set = (patch: Partial<BlockDraft>): void => setDraft({ ...draft, ...patch });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? 'Edit block' : 'New block'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={draft.kind}
            onChange={(_, kind: BlockKind | null) => {
              if (!kind) return;
              set(
                kind === 'unavailable'
                  ? {
                      kind,
                      reason: draft.reason ?? 'lunch',
                      label: draft.label || REASON_LABEL[draft.reason ?? 'lunch'],
                    }
                  : { kind, reason: undefined }
              );
            }}
          >
            <ToggleButton value="bookable">Bookable</ToggleButton>
            <ToggleButton value="unavailable">Unavailable</ToggleButton>
          </ToggleButtonGroup>

          {draft.kind === 'unavailable' && (
            <TextField
              select
              label="Reason"
              size="small"
              value={draft.reason ?? 'other'}
              onChange={(e) => {
                const reason = e.target.value as UnavailableReason;
                const autoLabel = Object.values(REASON_LABEL).includes(draft.label) || !draft.label;
                set({ reason, label: autoLabel ? REASON_LABEL[reason] : draft.label });
              }}
            >
              {UNAVAILABLE_REASONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {REASON_LABEL[r]}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            label="Label"
            size="small"
            required
            value={draft.label}
            placeholder={draft.kind === 'bookable' ? 'e.g. New patients, Same-day sick' : undefined}
            onChange={(e) => set({ label: e.target.value })}
            helperText="Shown on the provider's calendar."
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {editing ? 'Day' : 'Days'}
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={draft.weekdays}
              exclusive={editing}
              onChange={(_, value: IsoWeekday[] | IsoWeekday | null) => {
                if (value === null) return;
                set({ weekdays: Array.isArray(value) ? value : [value] });
              }}
            >
              {ALL_DAYS.map((d) => (
                <ToggleButton key={d} value={d} sx={{ px: 1.5 }}>
                  {WEEKDAY_SHORT[d]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {!editing && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Pick several days to add the same block to each.
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Start"
              type="time"
              size="small"
              value={draft.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
              inputProps={{ step: 300 }}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="End"
              type="time"
              size="small"
              value={draft.endTime}
              onChange={(e) => set({ endTime: e.target.value })}
              inputProps={{ step: 300 }}
              InputLabelProps={{ shrink: true }}
              error={!timesValid}
              helperText={!timesValid ? 'End must be after start' : undefined}
              sx={{ flex: 1 }}
            />
          </Stack>

          {draft.kind === 'bookable' && (
            <>
              <Autocomplete
                multiple
                size="small"
                options={providerVisitTypes}
                value={providerVisitTypes.filter((v) => draft.visitTypeIds.includes(v.id))}
                getOptionLabel={(v) => `${v.name} (${v.durationMinutes} min)`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, value) => set({ visitTypeIds: value.map((v) => v.id) })}
                renderTags={(value, getTagProps) =>
                  value.map((v, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={v.id}
                      size="small"
                      label={v.name}
                      sx={{
                        bgcolor: v.color,
                        color: '#fff',
                        '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.8)' },
                      }}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Visit types"
                    placeholder={draft.visitTypeIds.length ? undefined : 'Any visit type'}
                    helperText="Leave empty to allow any visit type this provider offers."
                  />
                )}
              />
              {timesValid && allowed.length > 0 && (
                <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                  <Typography variant="body2">
                    {minutes} minutes fits{' '}
                    {allowed
                      .map(
                        (v) =>
                          `${slotsThatFit(minutes, v.durationMinutes)} × ${v.name.toLowerCase()} (${
                            v.durationMinutes
                          } min)`
                      )
                      .join(', or ')}
                    .
                  </Typography>
                </Alert>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {editing && onDelete && (
          <Button color="error" onClick={() => onDelete(draft.id!)} sx={{ mr: 'auto' }}>
            Delete block
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => onSave(draft)}>
          {editing ? 'Update' : draft.weekdays.length > 1 ? `Add to ${draft.weekdays.length} days` : 'Add block'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
