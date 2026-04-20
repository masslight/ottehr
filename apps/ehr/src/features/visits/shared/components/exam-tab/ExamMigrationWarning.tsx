import { otherColors } from '@ehrTheme/colors';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import { LoadingButton } from '@mui/lab';
import { FormControl, FormControlLabel, Radio, RadioGroup, Typography, useTheme } from '@mui/material';
import { Stack } from '@mui/system';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { migrateExamData } from 'src/api/api';
import { CHART_DATA_QUERY_KEY } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { useExamObservationsStore } from '../../stores/appointment/exam-observations.store';

const NORMAL_EXTERNAL_GENITAL_EXAM_FIELD = 'normal-external-genital-exam';

type ExamMigrationWarningProps = {
  unmatchedFields: string[];
};

export const ExamMigrationWarning: FC<ExamMigrationWarningProps> = ({ unmatchedFields }) => {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const { resources } = useAppointmentData();
  const queryClient = useQueryClient();
  const [isMigrating, setIsMigrating] = useState(false);
  const [genitalExamSex, setGenitalExamSex] = useState<'male' | 'female' | undefined>(undefined);

  const needsGenitalExamChoice = unmatchedFields.includes(NORMAL_EXTERNAL_GENITAL_EXAM_FIELD);
  const canMigrate = !needsGenitalExamChoice || genitalExamSex !== undefined;

  const handleMigrate = async (): Promise<void> => {
    if (!oystehrZambda || !resources.encounter?.id) return;

    setIsMigrating(true);
    try {
      await migrateExamData(oystehrZambda, {
        encounterId: resources.encounter.id,
        ...(needsGenitalExamChoice && genitalExamSex ? { normalExternalGenitalExamSex: genitalExamSex } : {}),
      });
      enqueueSnackbar('Exam data migrated successfully', { variant: 'success' });
      // Remove only the unmatched fields from the store without touching hasInitialData
      const currentState = useExamObservationsStore.getState();
      const filteredState = Object.fromEntries(
        Object.entries(currentState).filter(([key]) => !unmatchedFields.includes(key))
      );
      useExamObservationsStore.setState(filteredState, true);
      // Refetch chart data to pull in the newly migrated observations
      await queryClient.invalidateQueries({
        queryKey: [CHART_DATA_QUERY_KEY, resources.encounter.id],
        refetchType: 'active',
      });
    } catch (error) {
      console.error('Migration failed:', error);
      enqueueSnackbar('Failed to migrate exam data. Please try again.', { variant: 'error' });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Stack
      style={{
        background: otherColors.lightErrorBg,
        padding: '16px',
        borderRadius: '4px',
        width: '100%',
      }}
      alignItems="flex-start"
      gap={1.5}
    >
      <Stack direction="row" alignItems="center">
        <ErrorOutlineOutlined style={{ width: '20px', height: '20px', color: theme.palette.error.main }} />
        <Typography variant="body2" style={{ color: otherColors.lightErrorText, marginLeft: '12px' }}>
          <span style={{ fontWeight: '500' }}>Exam Configuration Mismatch: </span>
          {`This exam contains ${unmatchedFields.length} finding${unmatchedFields.length > 1 ? 's' : ''} that ${
            unmatchedFields.length > 1 ? 'do' : 'does'
          } not match the current exam configuration: ${unmatchedFields.join(
            ', '
          )}. You can safely migrate this information to the new exam format by clicking the button below.`}
        </Typography>
      </Stack>
      {needsGenitalExamChoice && (
        <Stack gap={0.5} ml="32px">
          <Typography variant="body2" style={{ color: otherColors.lightErrorText, fontWeight: '500' }}>
            The &quot;Normal external genital exam&quot; finding has been split into male and female sections. Please
            select which section applies to this patient:
          </Typography>
          <FormControl>
            <RadioGroup
              row
              value={genitalExamSex ?? ''}
              onChange={(e) => setGenitalExamSex(e.target.value as 'male' | 'female')}
            >
              <FormControlLabel
                value="male"
                control={<Radio size="small" />}
                label={
                  <Typography variant="body2" style={{ color: otherColors.lightErrorText }}>
                    GU (Male) — Normal external genital/testicular exam
                  </Typography>
                }
              />
              <FormControlLabel
                value="female"
                control={<Radio size="small" />}
                label={
                  <Typography variant="body2" style={{ color: otherColors.lightErrorText }}>
                    GU (Female) — Normal external genital exam
                  </Typography>
                }
              />
            </RadioGroup>
          </FormControl>
        </Stack>
      )}
      <LoadingButton
        variant="contained"
        size="small"
        onClick={handleMigrate}
        loading={isMigrating}
        disabled={!canMigrate}
        sx={{ textTransform: 'none', borderRadius: '16px', ml: '32px' }}
      >
        Migrate Exam Data
      </LoadingButton>
    </Stack>
  );
};
