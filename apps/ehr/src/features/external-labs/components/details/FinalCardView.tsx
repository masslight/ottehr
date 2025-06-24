import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Divider } from '@mui/material';
import { FC } from 'react';
import { ExternalLabsStatus } from 'utils';

interface FinalCardViewProps {
  resultPdfUrl: string | null;
  labStatus: ExternalLabsStatus;
  onMarkAsReviewed: () => void;
  loading: boolean;
}

export const FinalCardView: FC<FinalCardViewProps> = ({ resultPdfUrl, labStatus, onMarkAsReviewed, loading }) => {
  const openPdf = (): void => {
    if (resultPdfUrl) {
      window.open(resultPdfUrl, '_blank');
    }
  };

  const isMarkAsReviewedButtonVisible =
    labStatus === ExternalLabsStatus.received || labStatus === ExternalLabsStatus.corrected;

  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
      <Box sx={{ padding: 2 }}>
        <Button
          variant="outlined"
          startIcon={<BiotechOutlinedIcon />}
          onClick={openPdf}
          sx={{ borderRadius: '50px', textTransform: 'none' }}
          disabled={!resultPdfUrl}
        >
          View Results
        </Button>
      </Box>

      {/* while toggle is hidden, the bottom panel is visible only when the button is visible */}
      {isMarkAsReviewedButtonVisible ? (
        <>
          <Divider />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 2 }}>
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

            {isMarkAsReviewedButtonVisible ? (
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
                Mark as Reviewed
              </LoadingButton>
            ) : null}
          </Box>
        </>
      ) : null}
    </Box>
  );
};
