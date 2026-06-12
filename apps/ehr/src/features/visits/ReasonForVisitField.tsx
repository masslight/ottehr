import { Box, FormControl, InputLabel, MenuItem, Select, Skeleton, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getCoding, SERVICE_CATEGORY_SYSTEM } from 'utils';
import { useChartFields } from './shared/hooks/useChartFields';
import { useReasonForVisitOptions } from './shared/hooks/useReasonForVisitOptions';
import { useAppointmentData, useSaveChartData } from './shared/stores/appointment/appointment.store';

export const ReasonForVisitField: FC = () => {
  const saveChartData = useSaveChartData();
  const [reasonForVisit, setReasonForVisit] = useState<string>('');
  const { data: chartFields, isFetched: isChartFieldsFetched } = useChartFields({
    requestedFields: { reasonForVisit: {} },
  });

  useEffect(() => {
    if (isChartFieldsFetched) {
      setReasonForVisit(chartFields?.reasonForVisit?.text ?? '');
    }
  }, [chartFields, isChartFieldsFetched]);

  const { appointment } = useAppointmentData();
  const serviceCategory = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
  const rfvOptions = useReasonForVisitOptions(serviceCategory || 'urgent-care');
  // Saved chart data can resolve before the paginated FHIR catalog does.
  // If the saved value isn't in the loaded options yet (or has been removed
  // from the catalog entirely), passing it as Select.value triggers MUI's
  // "out-of-range value" console warning and renders blank. Defer the bind
  // until the options catch up; it snaps to the saved value on load.
  const valueIsAvailable = rfvOptions.some((opt) => opt.value === reasonForVisit);
  const safeValue = valueIsAvailable ? reasonForVisit : '';
  return (
    <FormControl fullWidth>
      <InputLabel id="reason-for-visit-label">Reason for visit</InputLabel>
      <Select
        data-testid={dataTestIds.addPatientPage.reasonForVisitDropdown}
        labelId="reason-for-visit-label"
        id="reason-for-visit-select"
        value={safeValue}
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
        {rfvOptions.map((reason) => (
          <MenuItem key={reason.value} value={reason.value}>
            {reason.label}
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
