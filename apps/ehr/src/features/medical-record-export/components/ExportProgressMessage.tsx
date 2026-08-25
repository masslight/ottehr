import { Box, LinearProgress, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatExportProgress } from '../model/medicalRecordExportPolling';
import { selectExportByTaskId, useMedicalRecordExportStore } from '../store/medicalRecordExport.store';

/**
 * Its own store-subscribed component so the count advances without the snackbar being re-created:
 * notistack has no update-in-place API, and re-enqueueing per tick would flash it dozens of times.
 */
export const ExportProgressMessage = ({ taskId }: { taskId: string }): ReactElement => {
  const job = useMedicalRecordExportStore(selectExportByTaskId(taskId));
  const processed = job?.processed;
  const total = job?.total;
  // Indeterminate until the worker publishes a total; the size pass is still running before that.
  const percent = total && total > 0 ? Math.min(100, Math.round(((processed ?? 0) / total) * 100)) : undefined;

  return (
    <Box sx={{ minWidth: 260 }} data-testid={dataTestIds.patientRecordPage.medicalRecordExportProgress}>
      <Typography variant="body2" component="div">
        Preparing medical record — {formatExportProgress(processed, total)}
      </Typography>
      <LinearProgress
        variant={percent === undefined ? 'indeterminate' : 'determinate'}
        value={percent}
        sx={{
          mt: 0.75,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          '& .MuiLinearProgress-bar': { backgroundColor: 'common.white' },
        }}
      />
    </Box>
  );
};
