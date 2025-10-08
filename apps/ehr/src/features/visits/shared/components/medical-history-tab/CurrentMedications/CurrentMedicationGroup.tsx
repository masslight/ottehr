import { Box, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { MedHistorySubsectionTypography } from 'src/features/visits/in-person/components/MedHistorySubsectionTypography';
import { DATE_FORMAT, MedicationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';

export const CurrentMedicationGroup = ({
  label,
  medications,
  isLoading,
  onRemove,
  dataTestId,
}: {
  label: string;
  medications: MedicationDTO[];
  isLoading: boolean;
  onRemove: (resourceId: string) => void;
  dataTestId: string;
}): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
      data-testid={dataTestId}
    >
      <MedHistorySubsectionTypography sx={{ pb: 0.5 }}>{label}</MedHistorySubsectionTypography>
      <ActionsList
        data={medications}
        getKey={(value) => value.resourceId!}
        itemDataTestId={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsListItem(dataTestId)}
        renderItem={(value) => <CurrentMedicationItem value={value} />}
        renderActions={
          isReadOnly
            ? undefined
            : (value) => <DeleteIconButton disabled={isLoading} onClick={() => onRemove(value.resourceId!)} />
        }
        divider
      />
    </Box>
  );
};

function CurrentMedicationItem({ value }: { value: MedicationDTO }): JSX.Element {
  const lastIntakeDate = value.intakeInfo.date && DateTime.fromISO(value.intakeInfo.date);
  let lastIntakeDateDisplay = '';
  if (lastIntakeDate instanceof DateTime) {
    lastIntakeDateDisplay = `${lastIntakeDate.toFormat(DATE_FORMAT)} at ${lastIntakeDate.toFormat('HH:mm a')}`;
  }
  const additionalInfo = [value.intakeInfo?.dose, lastIntakeDateDisplay].filter(Boolean).join(' ');

  return (
    <Typography variant="body2">
      {value.name}
      {additionalInfo ? `(${additionalInfo})` : ''}
    </Typography>
  );
}
