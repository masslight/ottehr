import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  getCoding,
  getReasonForVisitOptions,
  isScheduledFollowupEncounter,
  SCHEDULED_FOLLOWUP_OTHER_REASON,
  SCHEDULED_FOLLOWUP_REASONS,
  SERVICE_CATEGORY_SYSTEM,
} from 'utils';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';
import { useAppointmentData, useSaveChartData } from './shared/stores/appointment/appointment.store';

export const ReasonForVisitField: FC = () => {
  const saveChartData = useSaveChartData();
  const { appointment, encounter } = useAppointmentData();
  const isScheduledFollowUp = encounter ? isScheduledFollowupEncounter(encounter) : false;

  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  // Scheduled follow-ups pick from a fixed list; "Other" is stored as this free text.
  const [otherReason, setOtherReason] = useState<string>('');
  const { data: chartFields, isFetched: isChartFieldsFetched } = useChartFields({
    requestedFields: { reasonForVisit: {} },
  });

  const rfvOptions = useMemo(() => {
    const serviceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
    return getReasonForVisitOptions(isScheduledFollowUp, serviceCategory || 'urgent-care');
  }, [isScheduledFollowUp, appointment?.serviceCategory]);

  useEffect(() => {
    if (!isChartFieldsFetched) return;
    const storedText = chartFields?.reasonForVisit?.text ?? '';
    // A stored reason outside the fixed follow-up list is a free-text "Other".
    const isOtherStored =
      isScheduledFollowUp && !!storedText && !SCHEDULED_FOLLOWUP_REASONS.includes(storedText as never);
    setReasonForVisit(isOtherStored ? SCHEDULED_FOLLOWUP_OTHER_REASON : storedText);
    setOtherReason(isOtherStored ? storedText : '');
  }, [chartFields, isChartFieldsFetched, isScheduledFollowUp]);

  const isOtherReason = isScheduledFollowUp && reasonForVisit === SCHEDULED_FOLLOWUP_OTHER_REASON;
  // Free-text "Other" reason: debounced save (with cache sync / dedup) like other chart note fields.
  const { onValueChange: onOtherReasonChange, isLoading: isOtherReasonSaving } =
    useDebounceNotesField('reasonForVisit');

  const handleOtherReasonChange = (value: string): void => {
    setOtherReason(value);
    onOtherReasonChange(value);
  };

  return (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel id="reason-for-visit-label">Reason for visit</InputLabel>
        <Select
          data-testid={dataTestIds.addPatientPage.reasonForVisitDropdown}
          labelId="reason-for-visit-label"
          id="reason-for-visit-select"
          value={reasonForVisit || ''}
          label="Reason for visit"
          onChange={(event) => {
            const value = event.target.value as string;
            setReasonForVisit(value);

            // "Other" is persisted only once the free text is entered.
            if (isScheduledFollowUp && value === SCHEDULED_FOLLOWUP_OTHER_REASON) {
              return;
            }
            setOtherReason('');
            saveChartData.mutate({ reasonForVisit: { text: value } });
          }}
        >
          {rfvOptions.map((reason) => (
            <MenuItem key={reason.value} value={reason.value}>
              {reason.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {isOtherReason && (
        <TextField
          fullWidth
          label="Other reason"
          id="reason-for-visit-other-text"
          value={otherReason}
          onChange={(e) => handleOtherReasonChange(e.target.value)}
          InputProps={{
            endAdornment: isOtherReasonSaving && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size="20px" />
              </Box>
            ),
          }}
        />
      )}
    </Stack>
  );
};

type ReasonForVisitSource = 'patient' | 'intake';

const LABEL_BY_SOURCE: Record<ReasonForVisitSource, string> = {
  patient: 'Reason for visit selected by patient',
  intake: 'Reason for visit verified on intake',
};

interface ReasonForVisitFieldReadOnlyProps {
  valueSource?: ReasonForVisitSource;
}

export const ReasonForVisitFieldReadOnly: FC<ReasonForVisitFieldReadOnlyProps> = ({ valueSource = 'patient' }) => {
  const theme = useTheme();
  const { isAppointmentLoading, appointment, encounter } = useAppointmentData();

  const label = LABEL_BY_SOURCE[valueSource];

  const valueSelectors: Record<ReasonForVisitSource, string> = {
    patient: appointment?.description ?? '',
    intake: encounter?.extension?.find((e) => e.url === 'reason-for-visit')?.valueString ?? '',
  };
  const value = valueSelectors[valueSource];

  return (
    <Box>
      <Typography variant="subtitle2" color={theme.palette.primary.dark}>
        {label}
      </Typography>
      {isAppointmentLoading ? (
        <Skeleton width="100%">
          <Typography>.</Typography>
        </Skeleton>
      ) : (
        <Typography variant="body2" data-testid={dataTestIds.telemedEhrFlow.hpiReasonForVisit}>
          {value}
        </Typography>
      )}
    </Box>
  );
};
