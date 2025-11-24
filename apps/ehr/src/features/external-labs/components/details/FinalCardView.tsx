import { otherColors } from '@ehrTheme/colors';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { GET_TASKS_KEY } from 'src/features/visits/in-person/hooks/useTasks';
import { useCancelMatchUnsolicitedResultTask } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { ExternalLabsStatus, LAB_ORDER_UPDATE_RESOURCES_EVENTS } from 'utils';

interface FinalCardViewProps {
  isUnsolicited: boolean;
  resultPdfUrl: string | null;
  labStatus: ExternalLabsStatus;
  onMarkAsReviewed: () => void;
  loading: boolean;
  taskId?: string; // only for unsolicited
  labGeneratedResultUrl?: string;
}

export const FinalCardView: FC<FinalCardViewProps> = ({
  isUnsolicited,
  resultPdfUrl,
  labStatus,
  onMarkAsReviewed,
  loading,
  taskId,
  labGeneratedResultUrl,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openPdf = (url: string | null | undefined): void => {
    if (url) {
      window.open(url, '_blank');
    }
  };
  const { mutate: cancelTask, isPending: isCancelling } = useCancelMatchUnsolicitedResultTask();

  // todo later, this function is pretty much duplicated from /external-labs/pages/UnsolicitedResultsMatch.tsx
  // we should deduplicate
  const handleRejectUnsolicitedResult = (): void => {
    if (taskId) {
      cancelTask(
        {
          taskId: taskId,
          event: LAB_ORDER_UPDATE_RESOURCES_EVENTS.cancelUnsolicitedResultTask,
        },
        {
          onSuccess: async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: [GET_TASKS_KEY], exact: false }),
              queryClient.invalidateQueries({ queryKey: ['get unsolicited results resources'], exact: false }),
            ]);
            navigate('/tasks');
          },
          onError: (error) => {
            console.error('Cancel task failed:', error);
            enqueueSnackbar('An error occurred rejecting this task. Please try again.', { variant: 'error' });
          },
        }
      );
    } else {
      console.log('data.task could not be parsed');
      enqueueSnackbar('An error occurred rejecting this task. Please try again.', { variant: 'error' });
    }
  };

  const isMarkAsReviewedButtonVisible =
    labStatus === ExternalLabsStatus.received || labStatus === ExternalLabsStatus.corrected;

  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
      <Box sx={{ padding: 2 }}>
        {isUnsolicited && (
          // todo in the future can probably dedupe this banner code its being used through out unsolicited results and probably elsewhere too
          <Stack>
            <Box
              sx={{
                width: '100%',
                background: `${otherColors.infoBackground}`,
                display: 'flex',
                justifyContent: 'left',
                alignItems: 'center',
                borderRadius: '4px',
                py: '6px',
                px: '16px',
                mb: '8px',
              }}
              gap="12px"
            >
              <InfoIcon sx={{ color: 'info.main' }}></InfoIcon>
              <Typography variant="button" sx={{ textTransform: 'none', color: 'primary.dark' }}>
                This are unsolicited results from an outside source. Please review them, contact the patient, and accept
                the results to the Patient Record or reject them if they are not valid.
              </Typography>
            </Box>
          </Stack>
        )}
        <Button
          variant="outlined"
          startIcon={<BiotechOutlinedIcon />}
          onClick={() => openPdf(resultPdfUrl)}
          sx={{ borderRadius: '50px', textTransform: 'none' }}
          disabled={!resultPdfUrl}
        >
          View Results
        </Button>
        {labGeneratedResultUrl && (
          <Button
            variant="outlined"
            startIcon={<BiotechOutlinedIcon />}
            onClick={() => openPdf(labGeneratedResultUrl)}
            sx={{ borderRadius: '50px', textTransform: 'none', ml: '8px' }}
          >
            View Lab Generated Results
          </Button>
        )}
      </Box>

      {/* while toggle is hidden, the bottom panel is visible only when the button is visible */}
      {isMarkAsReviewedButtonVisible ? (
        <>
          <Divider />

          <Box sx={{ display: 'flex', justifyContent: 'end', padding: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* <Switch
                    disabled={true} // todo: will be released in the future
                    checked={false} // todo: will be released in the future
                    onChange={() => null} // todo: will be released in the future
                    color="primary"
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="body2">Show Results on the Patient Portal</Typography> */}
            </Box>

            {isUnsolicited && (
              <LoadingButton
                loading={isCancelling}
                variant="outlined"
                sx={{
                  borderRadius: '50px',
                  textTransform: 'none',
                  py: 1,
                  px: 3,
                  mr: '8px',
                  textWrap: 'nowrap',
                  fontSize: '15px',
                }}
                color="error"
                size={'medium'}
                onClick={handleRejectUnsolicitedResult}
              >
                Reject
              </LoadingButton>
            )}

            <LoadingButton
              loading={loading}
              variant="contained"
              onClick={onMarkAsReviewed}
              sx={{
                borderRadius: '50px',
                textTransform: 'none',
              }}
              color="primary"
            >
              {isUnsolicited ? 'Mark as Reviewed & Accept' : 'Mark as Reviewed'}
            </LoadingButton>
          </Box>
        </>
      ) : null}
    </Box>
  );
};
