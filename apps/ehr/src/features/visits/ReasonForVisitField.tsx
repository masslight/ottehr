import { Box, FormControl, InputLabel, MenuItem, Select, Skeleton, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { BOOKING_CONFIG } from 'utils';
import { useChartFields } from './shared/hooks/useChartFields';
import { useAppointmentData, useSaveChartData } from './shared/stores/appointment/appointment.store';

export const ReasonForVisitField: FC = () => {
  const saveChartData = useSaveChartData();
  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  const { data: chartFields } = useChartFields({
    requestedFields: { reasonForVisit: {} },
  });

  useEffect(() => {
    if (chartFields?.reasonForVisit?.text) {
      setReasonForVisit(chartFields.reasonForVisit.text);
    }
  }, [chartFields]);

  return (
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

          saveChartData.mutate({
            reasonForVisit: {
              text: value,
            },
          });
        }}
      >
        {BOOKING_CONFIG.reasonForVisitOptions.map((reason) => (
          <MenuItem key={reason} value={reason}>
            {reason}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
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
